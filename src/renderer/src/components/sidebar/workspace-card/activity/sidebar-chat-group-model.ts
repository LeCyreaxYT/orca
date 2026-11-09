import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import {
  GENERAL_CHAT_GROUP,
  type SidebarChatGroups
} from '../../../../../../shared/sidebar-chat-groups'
import { agentRowDisplayDotState } from '@/lib/agent-status/presentation/agent-row-dot-state'
import type { AgentDotState } from '@/components/AgentStateDot'

export function sidebarChatIdentity(agent: DashboardAgentRow): string {
  return agent.paneKey
}

export function sidebarChatGroup(agent: DashboardAgentRow, state: SidebarChatGroups): string {
  return state.assignments[sidebarChatIdentity(agent)] ?? GENERAL_CHAT_GROUP
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
