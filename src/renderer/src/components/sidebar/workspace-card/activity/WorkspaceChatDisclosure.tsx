import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'

export function WorkspaceChatDisclosure({
  worktreeId,
  name
}: {
  worktreeId: string
  name: string
}) {
  const t = useTranslate()
  const collapsed = useAppStore(
    (state) => state.sidebarChatGroupsByWorktree[worktreeId]?.workspaceCollapsed === true
  )
  const edit = useAppStore((state) => state.editSidebarChatGroup)
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-label={
        collapsed
          ? t('sidebar.chatGroups.expandWorkspace', 'Show chats in {{name}}', { name })
          : t('sidebar.chatGroups.collapseWorkspace', 'Hide chats in {{name}}', { name })
      }
      className="flex h-8 w-5 shrink-0 items-center justify-center text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        edit(worktreeId, { kind: 'toggle-workspace' })
      }}
    >
      {collapsed ? (
        <Folder className="size-3.5" aria-hidden />
      ) : (
        <FolderOpen className="size-3.5" aria-hidden />
      )}
    </button>
  )
}

export function WorkspaceChatChevron({ worktreeId }: { worktreeId: string }) {
  const collapsed = useAppStore(
    (state) => state.sidebarChatGroupsByWorktree[worktreeId]?.workspaceCollapsed === true
  )
  return collapsed ? (
    <ChevronRight className="size-3 shrink-0 text-muted-foreground" aria-hidden />
  ) : (
    <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
  )
}

export function WorkspaceChatList({
  worktreeId,
  children
}: {
  worktreeId: string
  children: React.ReactNode
}) {
  const collapsed = useAppStore(
    (state) => state.sidebarChatGroupsByWorktree[worktreeId]?.workspaceCollapsed === true
  )
  return collapsed ? null : <div className="pl-1 @3xs/sidebar:pl-6">{children}</div>
}
