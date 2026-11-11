import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useAllWorktrees } from '@/store/slices/worktrees/listing/use-worktree-catalog'
import { selectFolderWorkspaces } from '@/store/workspaces/catalog/workspace-record-fields'
import { getFolderWorkspaceWorktree } from '../../../../../shared/folder-workspaces/folder-workspace-worktree'

export function useSidebarChatWorkspaces() {
  const worktrees = useAllWorktrees()
  const folders = useAppStore(selectFolderWorkspaces)
  return useMemo(
    () => [...worktrees, ...folders.map((folder) => getFolderWorkspaceWorktree(folder))],
    [worktrees, folders]
  )
}
