import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useSidebarChatHistory } from './sidebar-chat-history-store'
import { projectGroupIdFromRepoId } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'
import type { Worktree } from '../../../../../shared/worktree/types'

export function useSidebarWorkspaceTitle(workspace: Worktree, fallback: string): string {
  const sources = useAppStore((state) => state.sidebarChatGroupsByWorktree[workspace.id]?.sources)
  const structure = useSidebarChatHistory((state) => state.structure)
  return useMemo(() => {
    const basename = workspace.path
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .at(-1)
    // Preserve deliberate local names; only the untouched folder basename inherits its mapped project name.
    if (
      (workspace.hostId && workspace.hostId !== 'local') ||
      !projectGroupIdFromRepoId(workspace.repoId) ||
      workspace.displayName !== basename
    ) {
      return fallback
    }
    const names = new Set(
      (sources ?? [])
        .filter((source) => source.agent === 'codex' && source.executionHostId === 'local')
        .flatMap((source) => {
          const id = source.projectId
            ? (structure.projectAliases?.[source.projectId] ?? source.projectId)
            : null
          const project = structure.projects.find((project) => project.id === id)
          return project?.name.trim() ? [project.name] : []
        })
    )
    return names.size === 1 ? [...names][0]! : fallback
  }, [
    workspace.path,
    workspace.repoId,
    workspace.displayName,
    workspace.hostId,
    fallback,
    sources,
    structure
  ])
}
