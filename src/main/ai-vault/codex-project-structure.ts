import { readFile, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
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
  'pinned-thread-ids': z.array(z.string()).optional()
})
const Project = z.object({ id: z.string(), name: z.string(), rootPaths: z.array(z.string()) })
const Assignment = z.object({ projectKind: z.literal('local'), projectId: z.string() })

export function parseCodexProjectStructure(value: unknown): CodexProjectStructure {
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
  return { projects, assignments, pinned: state['pinned-thread-ids'] ?? [], available: true }
}

export async function readCodexProjectStructure(): Promise<CodexProjectStructure> {
  const home = process.env.CODEX_HOME || join(homedir(), '.codex')
  const path = join(home, '.codex-global-state.json')
  try {
    const databases = (await readdir(home))
      .filter((name) => /^state_\d+\.sqlite$/.test(name))
      .sort((a, b) => Number(b.match(/\d+/)?.[0]) - Number(a.match(/\d+/)?.[0]))
    if (databases[0]) {
      const result = await readCodexDesktopSidebar(join(home, databases[0]))
      if (result.kind === 'ok') {
        return result.structure
      }
      if (result.kind === 'unavailable') {
        throw new Error('Codex project database could not be read.')
      }
    }
    if ((await stat(path)).size > 16 * 1024 * 1024) {
      throw new Error('Codex project metadata is too large.')
    }
    return parseCodexProjectStructure(JSON.parse(await readFile(path, 'utf8')))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return EMPTY_CODEX_PROJECT_STRUCTURE
    }
    throw error
  }
}
