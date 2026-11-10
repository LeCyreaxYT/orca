import type { AiVaultSession } from './ai-vault/contracts/ai-vault-types'
import type { CodexProjectStructure } from './ai-vault/contracts/codex-project-structure'
import type { SidebarChatGroupsByWorktree } from './sidebar-chat-groups'
import { isPathInsideOrEqual, normalizeRuntimePathForComparison } from './cross-platform-path'
import { stripWin32LongPathPrefix } from './windows-path-access'

export function sidebarHistoryChatId(
  session: Pick<AiVaultSession, 'executionHostId' | 'agent' | 'sessionId'>
): string {
  return JSON.stringify(['history', session.executionHostId, session.agent, session.sessionId])
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
  let best: { workspaceId: string; length: number } | null = null
  for (const [workspaceId, state] of Object.entries(mappings)) {
    for (const source of state.sources ?? []) {
      if (source.agent !== session.agent || source.executionHostId !== session.executionHostId) {
        continue
      }
      const knownProject = structure.projects.find((project) => project.id === source.projectId)
      const matchingRoots = knownProject
        ? []
        : structure.projects.filter(
            (project) =>
              normalizeRuntimePathForComparison(project.paths[0] ?? '') ===
              normalizeRuntimePathForComparison(source.path)
          )
      const project = knownProject ?? (matchingRoots.length === 1 ? matchingRoots[0] : undefined)
      if (explicitProject) {
        if (source.projectId === explicitProject || project?.id === explicitProject) {
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
