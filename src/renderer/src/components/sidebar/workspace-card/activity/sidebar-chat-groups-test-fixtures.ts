import { applyAgentRowLineage } from '../../../dashboard/agent-row-lineage'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import { structuredAgentSessionPaneKey } from '../../../../../../shared/agent-session/view/structured-agent-session-projection'
import type { Tab } from '../../../../../../shared/tab-types'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import { makeRepo, makeWorktree } from '../../../worktree-jump/worktree-jump-palette-test-fixtures'
import { useSidebarChatHistory } from '../../chat-sources/sidebar-chat-history-store'
import { getDefaultSettings } from '../../../../../../shared/constants'
import type { AppState } from '@/store/types'
import { clearWorktreeAgentExpansionStateForTests } from './worktree-card-agents-expansion-state'

export const workspaceId = 'chat-groups-fixture'
export const titles = [
  'Orca-Seitenleiste vereinfachen',
  'Release vorbereiten',
  'Build prüfen',
  'Änderungen prüfen',
  'Activities: Kart-Stabilität',
  'Firejob-Ticket ansehen',
  'Website und Paket-Anleitung',
  'Garage: Kennzeichen prüfen',
  'Installationsanleitung',
  'Konfiguration übernehmen',
  'Materialien für den nächsten Release',
  'Geprüfte Änderungen zusammenführen'
]
export const tabs: Tab[] = titles.map((title, index) => ({
  id: `fixture-tab-${index}`,
  entityId: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`,
  contentType: 'agent-session',
  agentSessionAgent: index % 2 ? 'claude' : 'codex',
  worktreeId: workspaceId,
  groupId: 'fixture-tab-group',
  executionHostId: 'local',
  label: title,
  customLabel: title,
  color: null,
  sortOrder: index,
  createdAt: 1
}))
export const paneKeys = tabs.map((tab) => structuredAgentSessionPaneKey(tab.id, tab.entityId))
export const entries: AgentStatusEntry[] = tabs.map((tab, index) => ({
  paneKey: paneKeys[index],
  worktreeId: workspaceId,
  agentType: tab.agentSessionAgent,
  state: index >= 1 && index <= 3 ? 'working' : 'done',
  prompt: titles[index],
  terminalTitle: titles[index],
  updatedAt: Date.now(),
  stateStartedAt: Date.now(),
  stateHistory: [],
  ...(index === 2 || index === 3
    ? {
        orchestration: {
          taskId: `task-${index}`,
          dispatchId: `dispatch-${index}`,
          parentPaneKey: paneKeys[1]
        }
      }
    : {})
}))
export const rows = applyAgentRowLineage(
  buildWorktreeAgentRows({
    tabs: [],
    representedTabs: new Map(tabs.map((tab, index) => [paneKeys[index], tab])),
    entries,
    retained: [],
    now: Date.now()
  })
)

export const repo = { ...makeRepo(), displayName: 'SkySystems' }
export const workspace = makeWorktree(workspaceId, 'Scripts', {
  path: 'F:/Development/_SkySystems/Scripts'
})
export const fixtureState: Partial<AppState> = {
  settings: getDefaultSettings('/home/fixture'),
  repos: [repo],
  worktreesByRepo: { [repo.id]: [workspace] },
  unifiedTabsByWorktree: { [workspaceId]: tabs },
  agentStatusByPaneKey: Object.fromEntries(entries.map((entry) => [entry.paneKey, entry])),
  agentActivityDisplayMode: 'full' as const,
  worktreeCardProperties: ['inline-agents', 'branch'],
  sidebarChatGroupsByWorktree: {
    [workspaceId]: {
      groups: [{ id: 'release', name: 'Releases' }],
      assignments: { [paneKeys[0]]: 'pinned', [paneKeys[1]]: 'release' },
      collapsed: []
    }
  }
}
export function resetSidebarFixture() {
  clearWorktreeAgentExpansionStateForTests()
  useSidebarChatHistory.setState({ sessions: [] })
}
