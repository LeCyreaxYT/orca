import { defineFixture } from '../../../../component-fixtures/component-fixture'
import WorktreeCardAgents from './WorktreeCardAgents'
import { applyAgentRowLineage } from '../../../dashboard/agent-row-lineage'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import { structuredAgentSessionPaneKey } from '../../../../../../shared/agent-session/view/structured-agent-session-projection'
import type { Tab } from '../../../../../../shared/tab-types'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'

const workspaceId = 'chat-groups-fixture'
const titles = [
  'Orca-Seitenleiste vereinfachen',
  'Release vorbereiten',
  'Build prüfen',
  'Änderungen prüfen',
  'Activities: Kart-Stabilität',
  'Firejob-Ticket ansehen',
  'Website und Paket-Anleitung',
  'Garage: Kennzeichen prüfen',
  'Installationsanleitung'
]
const tabs: Tab[] = titles.map((title, index) => ({
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
const paneKeys = tabs.map((tab) => structuredAgentSessionPaneKey(tab.id, tab.entityId))
const entries: AgentStatusEntry[] = tabs.map((tab, index) => ({
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
const rows = applyAgentRowLineage(
  buildWorktreeAgentRows({
    tabs: [],
    representedTabs: new Map(tabs.map((tab, index) => [paneKeys[index], tab])),
    entries,
    retained: [],
    now: Date.now()
  })
)

export const organized = defineFixture({
  width: 360,
  store: {
    agentActivityDisplayMode: 'full',
    sidebarChatGroupsByWorktree: {
      [workspaceId]: {
        groups: [
          { id: 'releases', name: 'Releases' },
          { id: 'support', name: 'Support' }
        ],
        assignments: {
          [paneKeys[0]]: 'pinned',
          [paneKeys[1]]: 'releases',
          [paneKeys[4]]: 'releases',
          [paneKeys[5]]: 'support'
        },
        collapsed: ['support']
      }
    }
  },
  render: () => (
    <div className="bg-sidebar p-3 text-sidebar-foreground">
      <WorktreeCardAgents worktreeId={workspaceId} agents={rows} />
    </div>
  )
})
