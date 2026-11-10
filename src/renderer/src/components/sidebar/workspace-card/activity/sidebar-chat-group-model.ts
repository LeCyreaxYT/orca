import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import {
  GENERAL_CHAT_GROUP,
  type SidebarChatGroups
} from '../../../../../../shared/sidebar-chat-groups'
import { agentRowDisplayDotState } from '@/lib/agent-status/presentation/agent-row-dot-state'
import type { AgentDotState } from '@/components/AgentStateDot'
import { sidebarHistoryChatId } from '../../../../../../shared/sidebar-chat-sources'
import {
  getConnectionExecutionHostId,
  normalizeExecutionHostId
} from '../../../../../../shared/execution-host'

export function sidebarChatIdentity(agent: DashboardAgentRow): string {
  const sessionId = agent.tab.aiVaultTitle?.sessionId ?? agent.entry.providerSession?.id
  return sessionId && (agent.agentType === 'codex' || agent.agentType === 'claude')
    ? sidebarHistoryChatId({
        executionHostId:
          normalizeExecutionHostId(agent.entry.connectionId) ??
          getConnectionExecutionHostId(agent.entry.connectionId),
        agent: agent.agentType === 'codex' ? 'codex' : 'claude',
        sessionId
      })
    : agent.paneKey
}

export function sidebarChatGroup(
  agent: DashboardAgentRow,
  state: SidebarChatGroups,
  providerPins: readonly string[] = []
): string {
  const providerSession = agent.tab.aiVaultTitle?.sessionId ?? agent.entry.providerSession?.id
  const providerPinned =
    agent.agentType === 'codex' &&
    !agent.entry.connectionId &&
    providerSession &&
    providerPins.includes(providerSession)
  return (
    state.assignments[sidebarChatIdentity(agent)] ??
    state.assignments[agent.paneKey] ??
    (providerPinned ? 'pinned' : GENERAL_CHAT_GROUP)
  )
}

export function visibleSidebarChats(
  rows: readonly DashboardAgentRow[],
  focused: ReadonlySet<string>,
  childSignals: ReadonlyMap<string, AgentDotState>,
  expanded: boolean
): readonly DashboardAgentRow[] {
  if (expanded || rows.length <= 5) {
    return rows
  }
  const visible = new Set(rows.slice(0, 5))
  for (const row of rows) {
    const state = agentRowDisplayDotState(row)
    if (
      focused.has(row.paneKey) ||
      childSignals.has(row.paneKey) ||
      !['idle', 'done', 'unverifiable'].includes(state)
    ) {
      visible.add(row)
    }
  }
  return rows.filter((row) => visible.has(row))
}
