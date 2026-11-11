import { useAgentRowConversationName } from '@/components/dashboard/use-agent-row-conversation-name'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import {
  sidebarChatIdentity,
  sidebarChatSource
} from '../workspace-card/activity/sidebar-chat-group-model'
import { useSidebarChatHistory } from './sidebar-chat-history-store'

export function useSidebarChatName(agent: DashboardAgentRow): string | null {
  const id = sidebarChatIdentity(agent)
  const source = sidebarChatSource(agent)
  const localCodex = source?.agent === 'codex' && source.executionHostId === 'local'
  const providerName = useSidebarChatHistory((state) =>
    localCodex && source
      ? (state.structure.titles?.[source.sessionId] ?? state.sessionsById.get(id)?.title)
      : state.sessionsById.get(id)?.title
  )
  return useAgentRowConversationName(agent, providerName)
}
