import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useAllWorktrees } from '@/store/slices/worktrees/listing/use-worktree-catalog'
import { getFolderWorkspaceWorktree } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'

export function useSidebarChatWorkspaces() {
  const worktrees = useAllWorktrees()
  const folders = useAppStore((state) => state.folderWorkspaces)
  return useMemo(
    () => [...worktrees, ...folders.map((folder) => getFolderWorkspaceWorktree(folder))],
    [worktrees, folders]
  )
}
