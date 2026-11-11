import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { getIntlLocale } from '@/i18n/i18n'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { CodexProjectStructure } from '../../../../../../shared/ai-vault/contracts/codex-project-structure'
import type { SortBy } from '../../../../../../shared/sidebar-list/smart-sort'
import { getAgentRowPrimaryText } from '../../../../../../shared/agent-status/presentation/agent-row-primary-text'
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

export function sidebarChatSource(
  agent: DashboardAgentRow
): Pick<AiVaultSession, 'executionHostId' | 'agent' | 'sessionId'> | null {
  const sessionId = agent.tab.aiVaultTitle?.sessionId ?? agent.entry.providerSession?.id
  if (!sessionId || (agent.agentType !== 'codex' && agent.agentType !== 'claude')) {
    return null
  }
  return {
    executionHostId:
      normalizeExecutionHostId(agent.entry.connectionId) ??
      getConnectionExecutionHostId(agent.entry.connectionId),
    agent: agent.agentType === 'codex' ? 'codex' : 'claude',
    sessionId
  }
}

export function sidebarChatIdentity(agent: DashboardAgentRow): string {
  const source = sidebarChatSource(agent)
  return source ? sidebarHistoryChatId(source) : agent.paneKey
}

export type SidebarChatItem =
  | { agent: DashboardAgentRow; session?: never }
  | { session: AiVaultSession; agent?: never }

export function sortSidebarChats(
  rows: readonly SidebarChatItem[],
  options: {
    sortBy: SortBy
    sessions: ReadonlyMap<string, AiVaultSession>
    structure: CodexProjectStructure
  }
): SidebarChatItem[] {
  const prepared = rows.map((item) => {
    const source = item.agent ? sidebarChatSource(item.agent) : item.session
    const id = item.agent ? sidebarChatIdentity(item.agent) : sidebarHistoryChatId(item.session)
    const history = item.session ?? options.sessions.get(id)
    const codex = source?.agent === 'codex' && source.executionHostId === 'local'
    const providerTitle = codex ? options.structure.titles?.[source.sessionId] : undefined
    const title = item.agent
      ? item.agent.tab.customTitle ||
        providerTitle ||
        history?.title ||
        getAgentRowPrimaryText(item.agent.entry)
      : providerTitle || item.session.title
    const sourceUpdatedAt = codex ? options.structure.updatedAt?.[source.sessionId] : undefined
    const updatedAt =
      sourceUpdatedAt ??
      (history
        ? Date.parse(history.updatedAt ?? history.modifiedAt)
        : (item.agent?.entry.updatedAt ?? 0))
    const attention =
      item.agent && !['idle', 'done', 'unverifiable'].includes(agentRowDisplayDotState(item.agent))
        ? 1
        : 0
    return { item, id, title, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0, attention }
  })
  const names =
    options.sortBy === 'name'
      ? new Intl.Collator(getIntlLocale(), { numeric: true, sensitivity: 'base' })
      : null
  prepared.sort((a, b) => {
    const primary = names
      ? names.compare(a.title, b.title)
      : options.sortBy === 'smart'
        ? b.attention - a.attention
        : 0
    return primary || b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)
  })
  return prepared.map((row) => row.item)
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
