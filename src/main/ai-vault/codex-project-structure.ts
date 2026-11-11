import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { normalizeRuntimePathForComparison } from '../../shared/cross-platform-path'
import { stripWin32LongPathPrefix } from '../../shared/windows-path-access'
import { readCodexDesktopSidebar } from '../foreign-sqlite-readers/foreign-sqlite-reader-spawn'
import {
  EMPTY_CODEX_PROJECT_STRUCTURE,
  type CodexProjectStructure
} from '../../shared/ai-vault/contracts/codex-project-structure'

const State = z.object({
  'local-projects': z.record(z.string(), z.unknown()).optional(),
  'project-order': z.array(z.string()).optional(),
  'thread-project-assignments': z.record(z.string(), z.unknown()).optional(),
  'thread-project-membership-host-ids': z.record(z.string(), z.unknown()).optional(),
  'pinned-thread-ids': z.array(z.string()).optional(),
  'projectless-thread-ids': z.array(z.string()).optional(),
  'app-server-project-id-by-legacy-project-id-by-host': z
    .record(z.string(), z.unknown())
    .optional(),
  'app-server-projects-migration-by-host': z.record(z.string(), z.unknown()).optional()
})
const Project = z.object({ id: z.string(), name: z.string(), rootPaths: z.array(z.string()) })
const Assignment = z.object({ projectKind: z.literal('local'), projectId: z.string() })

export function parseCodexProjectStructure(
  value: unknown,
  options?: { native: CodexProjectStructure; home: string }
): CodexProjectStructure {
  const state = State.parse(value)
  const order = state['project-order'] ?? []
  const projects = Object.values(state['local-projects'] ?? {}).flatMap((value) => {
    const project = Project.safeParse(value)
    return project.success && project.data.rootPaths.length
      ? [{ id: project.data.id, name: project.data.name, paths: project.data.rootPaths }]
      : []
  })
  projects.sort((a, b) => {
    const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
    return rank(a.id) - rank(b.id)
  })
  const ids = new Set(projects.map((project) => project.id))
  const assignments = Object.fromEntries(
    Object.entries(state['thread-project-assignments'] ?? {}).flatMap(([id, value]) => {
      const assignment = Assignment.safeParse(value)
      const host = state['thread-project-membership-host-ids']?.[id]
      return assignment.success && ids.has(assignment.data.projectId) && (!host || host === 'local')
        ? [[id, assignment.data.projectId]]
        : []
    })
  )
  const desktop: CodexProjectStructure = {
    projects,
    assignments,
    pinned: state['pinned-thread-ids'] ?? [],
    ...(state['projectless-thread-ids'] ? { projectless: state['projectless-thread-ids'] } : {}),
    available: true
  }
  if (!options || state['local-projects'] === undefined) {
    return options?.native ?? desktop
  }
  return mergeCodexDesktopState(state, desktop, options)
}

function mergeCodexDesktopState(
  state: z.infer<typeof State>,
  desktop: CodexProjectStructure,
  options: { native: CodexProjectStructure; home: string }
): CodexProjectStructure {
  const { projects, assignments } = desktop
  const ids = new Set(projects.map((project) => project.id))
  const normalize = (path: string) =>
    normalizeRuntimePathForComparison(stripWin32LongPathPrefix(path))
  const aliasesByHost = state['app-server-project-id-by-legacy-project-id-by-host'] ?? {}
  const host = Object.keys(aliasesByHost).find(
    (host) => host.startsWith('local:') && normalize(host.slice(6)) === normalize(options.home)
  )
  const aliases = z.record(z.string(), z.string()).safeParse(host ? aliasesByHost[host] : {})
  const projectAliases = Object.fromEntries(
    Object.entries(aliases.success ? aliases.data : {}).flatMap(([legacy, native]) =>
      ids.has(legacy) ? [[native, legacy]] : []
    )
  )
  const native = options.native
  const mergedProjects = [
    ...projects,
    ...native.projects.filter((project) => !ids.has(project.id) && !projectAliases[project.id])
  ]
  const projectIds = new Set(mergedProjects.map((project) => project.id))
  const nativeAssignments = Object.fromEntries(
    Object.entries(native.assignments).flatMap(([thread, project]) => {
      const canonical = projectAliases[project] ?? project
      return projectIds.has(canonical) ? [[thread, canonical]] : []
    })
  )
  const migration = z
    .object({ threadAssignmentsMigrated: z.boolean().optional() })
    .safeParse(host ? state['app-server-projects-migration-by-host']?.[host] : undefined)
  const migrated = migration.success && migration.data.threadAssignmentsMigrated === true
  const knownNativeThreads = new Set(Object.keys(native.titles ?? {}))
  const legacyAssignments = migrated
    ? Object.fromEntries(
        Object.entries(assignments).filter(([thread]) => !knownNativeThreads.has(thread))
      )
    : assignments
  const mergedAssignments = { ...nativeAssignments, ...legacyAssignments }
  const projectless = new Set(
    (desktop.projectless ?? []).filter((thread) => !migrated || !knownNativeThreads.has(thread))
  )
  if (migrated) {
    for (const thread of knownNativeThreads) {
      if (!nativeAssignments[thread]) {
        projectless.add(thread)
      }
    }
  }
  for (const thread of projectless) {
    delete mergedAssignments[thread]
  }
  return {
    ...native,
    projects: mergedProjects,
    assignments: mergedAssignments,
    projectAliases,
    projectless: [...projectless],
    available: true
  }
}

export async function readCodexProjectStructure(): Promise<CodexProjectStructure> {
  const home = process.env.CODEX_HOME || join(homedir(), '.codex')
  const path = join(home, '.codex-global-state.json')
  try {
    let desktop: unknown
    try {
      if ((await stat(path)).size > 16 * 1024 * 1024) {
        throw new Error('Codex project metadata is too large.')
      }
      desktop = JSON.parse(await readFile(path, 'utf8'))
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }
    const databases = (await readdir(home))
      .filter((name) => /^state_\d+\.sqlite$/.test(name))
      .sort((a, b) => Number(b.match(/\d+/)?.[0]) - Number(a.match(/\d+/)?.[0]))
    if (databases[0]) {
      const result = await readCodexDesktopSidebar(join(home, databases[0]))
      if (result.kind === 'ok') {
        return desktop === undefined
          ? result.structure
          : parseCodexProjectStructure(desktop, { native: result.structure, home })
      }
      if (result.kind === 'unavailable' && desktop === undefined) {
        throw new Error('Codex project database could not be read.')
      }
    }
    return desktop === undefined
      ? EMPTY_CODEX_PROJECT_STRUCTURE
      : parseCodexProjectStructure(desktop)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return EMPTY_CODEX_PROJECT_STRUCTURE
    }
    throw error
  }
}
