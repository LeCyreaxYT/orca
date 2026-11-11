import type { AiVaultSession } from './ai-vault/contracts/ai-vault-types'
import type { CodexProjectStructure } from './ai-vault/contracts/codex-project-structure'
import {
  manualSidebarChatWorkspace,
  type SidebarChatGroupsByWorktree,
  type SidebarChatSource
} from './sidebar-chat-groups'
import type { Worktree } from './worktree/types'
import { automaticWorktreeDisplayName } from './worktree/display-name-provenance'
import { isPathInsideOrEqual, normalizeRuntimePathForComparison } from './cross-platform-path'
import { stripWin32LongPathPrefix } from './windows-path-access'

export function sidebarHistoryChatId(
  session: Pick<AiVaultSession, 'executionHostId' | 'agent' | 'sessionId'>
): string {
  return JSON.stringify(['history', session.executionHostId, session.agent, session.sessionId])
}

export function sidebarSourceCodexProject(
  source: SidebarChatSource,
  structure: CodexProjectStructure
): CodexProjectStructure['projects'][number] | undefined {
  const id = source.projectId
    ? (structure.projectAliases?.[source.projectId] ?? source.projectId)
    : undefined
  const known = structure.projects.find((project) => project.id === id)
  if (known) {
    return known
  }
  const normalize = (path: string) =>
    normalizeRuntimePathForComparison(stripWin32LongPathPrefix(path))
  const roots = structure.projects.filter(
    (project) => normalize(project.paths[0] ?? '') === normalize(source.path)
  )
  return roots.length === 1 ? roots[0] : undefined
}

export function sidebarWorkspaceTitle(
  workspace: Pick<
    Worktree,
    'path' | 'hostId' | 'displayName' | 'displayNameMode' | 'branch' | 'isMainWorktree'
  >,
  sources: readonly SidebarChatSource[],
  structure: CodexProjectStructure,
  fallback: string
): string {
  const basename = workspace.path
    .replace(/[\\/]+$/, '')
    .split(/[\\/]/)
    .at(-1)
  const automatic =
    workspace.displayNameMode !== 'fixed' &&
    (!workspace.displayName ||
      workspace.displayName === basename ||
      (workspace.isMainWorktree &&
        workspace.displayName ===
          automaticWorktreeDisplayName({
            branch: workspace.branch,
            path: workspace.path,
            projectName: undefined
          })))
  if ((workspace.hostId && workspace.hostId !== 'local') || !automatic) {
    return fallback
  }
  const names = new Set(
    sources
      .filter((source) => source.agent === 'codex' && source.executionHostId === 'local')
      .flatMap((source) => {
        const name = sidebarSourceCodexProject(source, structure)?.name.trim()
        return name ? [name] : []
      })
  )
  return names.size === 1 ? [...names][0]! : fallback
}

/** Explicit Codex membership wins over cwd; Claude uses the most specific mapped folder. */
export function mappedSidebarChatWorkspace(
  session: AiVaultSession,
  mappings: SidebarChatGroupsByWorktree,
  structure: CodexProjectStructure,
  workspaces: readonly { id: string; hostId?: string; isArchived?: boolean }[] = []
): string | null {
  if (session.subagent || !['codex', 'claude'].includes(session.agent)) {
    return null
  }
  const manual = manualSidebarChatWorkspace(sidebarHistoryChatId(session), mappings)
  if (
    manual &&
    workspaces.some(
      (workspace) =>
        workspace.id === manual &&
        !workspace.isArchived &&
        (workspace.hostId ?? 'local') === session.executionHostId
    )
  ) {
    return manual
  }
  if (
    session.structuredSession &&
    workspaces.some(
      (workspace) =>
        workspace.id === session.structuredSession?.workspaceId &&
        (workspace.hostId ?? 'local') === session.executionHostId &&
        !workspace.isArchived
    )
  ) {
    return session.structuredSession.workspaceId
  }
  const explicitProject =
    session.executionHostId === 'local' && session.agent === 'codex'
      ? structure.assignments[session.sessionId]
      : undefined
  if (
    session.executionHostId === 'local' &&
    session.agent === 'codex' &&
    structure.projectless?.includes(session.sessionId)
  ) {
    return null
  }
  let best: { workspaceId: string; length: number } | null = null
  for (const [workspaceId, state] of Object.entries(mappings)) {
    for (const source of state.sources ?? []) {
      if (source.agent !== session.agent || source.executionHostId !== session.executionHostId) {
        continue
      }
      const projectId = source.projectId
        ? (structure.projectAliases?.[source.projectId] ?? source.projectId)
        : undefined
      const project = sidebarSourceCodexProject(source, structure)
      if (explicitProject) {
        if (projectId === explicitProject || project?.id === explicitProject) {
          return workspaceId
        }
        continue
      }
      const paths = [session.cwd, ...(session.cwdAliases ?? [])]
      const sourcePath = stripWin32LongPathPrefix(project?.paths[0] ?? source.path)
      if (
        paths.some(
          (path) => path && isPathInsideOrEqual(sourcePath, stripWin32LongPathPrefix(path))
        )
      ) {
        const length = normalizeRuntimePathForComparison(sourcePath).length
        if (!best || length > best.length) {
          best = { workspaceId, length }
        }
      }
    }
  }
  return best?.workspaceId ?? null
}
