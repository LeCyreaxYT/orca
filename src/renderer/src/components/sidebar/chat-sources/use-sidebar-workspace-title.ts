import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useSidebarChatHistory } from './sidebar-chat-history-store'
import { sidebarWorkspaceTitle } from '../../../../../shared/sidebar-chat-sources'
import type { Worktree } from '../../../../../shared/worktree/types'

export function useSidebarWorkspaceTitle(workspace: Worktree, fallback: string): string {
  const sources = useAppStore((state) => state.sidebarChatGroupsByWorktree[workspace.id]?.sources)
  const structure = useSidebarChatHistory((state) => state.structure)
  return useMemo(
    () => sidebarWorkspaceTitle(workspace, sources ?? [], structure, fallback),
    [workspace, fallback, sources, structure]
  )
}
