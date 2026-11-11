import { useSidebarChatWorkspaces } from './use-sidebar-chat-workspaces'
import { useTranslate } from '@/i18n/use-translate'
import WorktreeCardAgents from '../workspace-card/activity/WorktreeCardAgents'

export function SidebarPinnedChats() {
  const t = useTranslate()
  const workspaces = useSidebarChatWorkspaces()
  return (
    <section
      data-sidebar-global-pins=""
      className="shrink-0 px-2 pt-3"
      aria-label={t('sidebar.chatGroups.pinned', 'Pinned')}
    >
      <h2
        data-sidebar-section-title="pinned"
        className="flex h-8 min-w-0 items-center truncate px-2 text-xs font-semibold text-muted-foreground"
      >
        {t('sidebar.chatGroups.pinned', 'Pinned')}
      </h2>
      <div className="scrollbar-sleek max-h-64 overflow-y-auto pl-2">
        {workspaces
          .filter((workspace) => !workspace.isArchived)
          .map((workspace) => (
            <WorktreeCardAgents
              key={`${workspace.hostId ?? 'local'}:${workspace.id}`}
              worktreeId={workspace.id}
              pinnedOnly
            />
          ))}
      </div>
    </section>
  )
}
