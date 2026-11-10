import { useSidebarChatHistory } from './sidebar-chat-history-store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'

export const SIDEBAR_CHAT_HISTORY_REFRESH = 'orca:refresh-sidebar-chat-history'

export function SidebarChatSourceNotice() {
  const error = useSidebarChatHistory((state) => state.error)
  const loading = useSidebarChatHistory((state) => state.loading)
  const t = useTranslate()
  return error ? (
    <div role="status" className="mx-3 my-2 space-y-1 text-xs text-muted-foreground">
      <p>
        {t(
          'sidebar.chatSources.refreshFailed',
          'Could not refresh linked chats. Your existing chats are still available.'
        )}
      </p>
      <Button
        variant="ghost"
        size="xs"
        disabled={loading}
        onClick={() => window.dispatchEvent(new Event(SIDEBAR_CHAT_HISTORY_REFRESH))}
      >
        {t('sidebar.chatSources.retry', 'Try again')}
      </Button>
    </div>
  ) : null
}
