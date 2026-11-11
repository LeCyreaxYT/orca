import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { useSidebarChatWorkspaces } from './use-sidebar-chat-workspaces'
import { normalizeRuntimePathForComparison } from '../../../../../shared/cross-platform-path'
import type { SidebarChatSource } from '../../../../../shared/sidebar-chat-groups'
import { useSidebarChatHistory } from './sidebar-chat-history-store'

/** Seed only unambiguous existing folders once; saved empty sources also count as an intentional setup. */
export function useSidebarChatSourceSetup() {
  const ready = useAppStore((state) => state.startupWorktreeRefreshCompleted)
  const configured = useAppStore((state) =>
    Object.values(state.sidebarChatGroupsByWorktree).some((group) => group.sources !== undefined)
  )
  const workspaces = useSidebarChatWorkspaces()
  const candidatesKey = JSON.stringify(
    workspaces
      .filter(
        (workspace) => !workspace.isArchived && (!workspace.hostId || workspace.hostId === 'local')
      )
      .map(({ id, path }) => ({ id, path }))
  )
  useEffect(() => {
    if (!ready || configured) {
      return
    }
    let active = true
    void window.api.aiVault
      .codexProjectStructure()
      .then((structure) => {
        const state = useAppStore.getState()
        if (
          !active ||
          Object.values(state.sidebarChatGroupsByWorktree).some(
            (group) => group.sources !== undefined
          )
        ) {
          return
        }
        const candidates: { id: string; path: string }[] = JSON.parse(candidatesKey)
        const sources = new Map<string, SidebarChatSource[]>()
        for (const project of structure.projects) {
          const matches = candidates.filter(
            (workspace) =>
              normalizeRuntimePathForComparison(workspace.path) ===
              normalizeRuntimePathForComparison(project.paths[0])
          )
          if (matches.length !== 1) {
            continue
          }
          const id = matches[0].id
          sources.set(id, [
            ...(sources.get(id) ?? []),
            {
              agent: 'codex',
              path: project.paths[0],
              projectId: project.id,
              executionHostId: 'local'
            },
            {
              agent: 'claude',
              path: project.paths[0],
              projectId: project.id,
              executionHostId: 'local'
            }
          ])
        }
        for (const [workspaceId, rules] of sources) {
          state.editSidebarChatGroup(workspaceId, { kind: 'sources', sources: rules })
        }
      })
      .catch((error) => {
        if (active) {
          useSidebarChatHistory.setState({ error: String(error) })
        }
      })
    return () => {
      active = false
    }
  }, [ready, configured, candidatesKey])
}
