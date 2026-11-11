import { defineFixture } from '../../../../component-fixtures/component-fixture'
import WorktreeCardAgents from './WorktreeCardAgents'
import { applyAgentRowLineage } from '../../../dashboard/agent-row-lineage'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import { structuredAgentSessionPaneKey } from '../../../../../../shared/agent-session/view/structured-agent-session-projection'
import type { Tab } from '../../../../../../shared/tab-types'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import { makeRepo, makeWorktree } from '../../../worktree-jump/worktree-jump-palette-test-fixtures'
import WorktreeCard from '../surface/WorktreeCard'
import { WorkspaceNewChatButton } from './WorkspaceNewChatButton'
import { useSidebarChatHistory } from '../../chat-sources/sidebar-chat-history-store'
import { getDefaultSettings } from '../../../../../../shared/constants'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import { SidebarPinnedChats } from '../../chat-sources/SidebarPinnedChats'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { AppState } from '@/store/types'
import { clearWorktreeAgentExpansionStateForTests } from './worktree-card-agents-expansion-state'
import SidebarNav from '../../SidebarNav'
import SidebarHeader from '../../SidebarHeader'
import SidebarToolbar from '../../SidebarToolbar'
import { createEmptyRateLimitState } from '../../../../../../shared/rate-limit-state-factory'

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
  'Installationsanleitung',
  'Konfiguration übernehmen',
  'Materialien für den nächsten Release',
  'Geprüfte Änderungen zusammenführen'
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

const repo = { ...makeRepo(), displayName: 'SkySystems' }
const workspace = makeWorktree(workspaceId, 'Scripts', {
  path: 'F:/Development/_SkySystems/Scripts'
})
const fixtureState: Partial<AppState> = {
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
function resetSidebarFixture() {
  clearWorktreeAgentExpansionStateForTests()
  useSidebarChatHistory.setState({ sessions: [] })
}
async function expandChildrenThroughPointer(frame: HTMLElement) {
  const toggle = frame.querySelector<HTMLButtonElement>('.agent-child-disclosure button')
  if (!toggle) {
    throw new Error('Child disclosure is missing')
  }
  const click = async () => {
    const bounds = toggle.getBoundingClientRect()
    const clientX = bounds.x + bounds.width / 2
    const clientY = bounds.y + bounds.height / 2
    const target = document.elementFromPoint(clientX, clientY)
    if (!target || !toggle.contains(target)) {
      throw new Error('Child disclosure is covered by another pointer target')
    }
    target.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, bubbles: true, clientX, clientY })
    )
    target.dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true, clientX, clientY }))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
  if (toggle.getAttribute('aria-expanded') === 'true') {
    await click()
  }
  await click()
  if (toggle.getAttribute('aria-expanded') !== 'true') {
    throw new Error('Pointer click did not expand child agents')
  }
}
function Navigation() {
  return (
    <div className="@container/sidebar min-h-96 bg-worktree-sidebar px-2 py-3 text-worktree-sidebar-foreground">
      <WorkspaceNewChatButton worktreeId={workspaceId} labelled />
      <SidebarPinnedChats />
      <div className="px-4 pb-2 pt-6 text-xs font-semibold text-muted-foreground">Projekte</div>
      <div className="flex items-center gap-1.5 px-2 py-2 text-[13px] font-semibold">
        <ChevronDown className="size-3.5" />
        <Folder className="size-3.5" />
        SkySystems
      </div>
      <WorktreeCard worktree={workspace} repo={repo} isActive nativeDragEnabled={false} />
      <div className="flex items-center gap-1.5 px-2 py-2 text-[13px] font-semibold">
        <ChevronRight className="size-3.5" />
        <Folder className="size-3.5" />
        Scripts_Phone
      </div>
      <div className="flex items-center gap-1.5 px-2 py-2 text-[13px] font-semibold">
        <ChevronRight className="size-3.5" />
        <Folder className="size-3.5" />
        Dienstblatt / SALi
      </div>
    </div>
  )
}
export const navigation = defineFixture({
  width: 280,
  store: fixtureState,
  setup: resetSidebarFixture,
  render: () => <Navigation />
})
export const navigationWide = defineFixture({
  width: 360,
  store: fixtureState,
  setup: resetSidebarFixture,
  render: () => <Navigation />
})
export const navigationMin = defineFixture({
  width: 220,
  store: fixtureState,
  setup: resetSidebarFixture,
  render: () => <Navigation />,
  interact: expandChildrenThroughPointer
})
export const navigationMax = defineFixture({
  width: 500,
  store: fixtureState,
  setup: resetSidebarFixture,
  render: () => <Navigation />
})

const approvedWorkspaces = [
  makeWorktree('approved-changelogs', 'Changelogs'),
  workspace,
  makeWorktree('approved-phone', 'Scripts_Phone'),
  makeWorktree('approved-dienst', 'Dienstblatt / SALi')
]
const usageNow = Date.now()
const usage = (provider: 'codex' | 'claude', session: number, weekly: number) => ({
  provider,
  session: {
    usedPercent: session,
    windowMinutes: 300,
    resetsAt: usageNow + 7200000,
    resetDescription: null
  },
  weekly: {
    usedPercent: weekly,
    windowMinutes: 10080,
    resetsAt: usageNow + 172800000,
    resetDescription: null
  },
  status: 'ok' as const,
  updatedAt: usageNow,
  error: null
})
export const approvedNavigation = defineFixture({
  width: 340,
  store: {
    ...fixtureState,
    worktreesByRepo: { [repo.id]: approvedWorkspaces },
    activeWorktreeId: workspaceId,
    setupGuideSidebarDismissed: true,
    persistedUIReady: true,
    sidebarChatGroupsByWorktree: {
      [workspaceId]: { groups: [], assignments: { [paneKeys[0]]: 'pinned' }, collapsed: [] }
    },
    rateLimits: createEmptyRateLimitState({
      codex: usage('codex', 23, 89),
      claude: usage('claude', 9, 20)
    }),
    activeOrcaProfileId: 'approved-profile',
    orcaProfiles: [
      {
        id: 'approved-profile',
        name: 'Alec',
        kind: 'local',
        avatar: { kind: 'initials', initials: 'AS', color: 'neutral' },
        createdAt: 1,
        updatedAt: 1,
        lastOpenedAt: 1
      }
    ]
  },
  setup: async () => {
    resetSidebarFixture()
    await import('../../SidebarUsage')
  },
  render: () => (
    <div className="@container/sidebar flex h-[900px] flex-col bg-worktree-sidebar text-worktree-sidebar-foreground">
      <SidebarNav />
      <SidebarPinnedChats />
      <SidebarHeader onWorkspaceBoardMenuOpenChange={() => {}} />
      <div className="min-h-0 flex-1 overflow-y-auto px-1 worktree-sidebar-scrollbar">
        {approvedWorkspaces.map((worktree) => (
          <WorktreeCard
            key={worktree.id}
            worktree={worktree}
            repo={repo}
            isActive={worktree.id === workspaceId}
            nativeDragEnabled={false}
          />
        ))}
      </div>
      <SidebarToolbar workspaceBoardOpen={false} onWorkspaceBoardToggle={() => {}} />
    </div>
  )
})

export const pinAndUnpin = defineFixture({
  width: 320,
  store: fixtureState,
  setup: resetSidebarFixture,
  render: () => <Navigation />,
  interact: async (frame) => {
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const key = paneKeys[4]
    const findRow = () =>
      [...frame.querySelectorAll<HTMLElement>('[data-sidebar-chat-row]')].find(
        (row) => row.dataset.sidebarChatRow === key
      )
    const move = async (label: string) => {
      const row = findRow()
      const menu = row
        ?.closest('.group\\/chat-row')
        ?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
      if (!menu) {
        throw new Error('Chat menu is unavailable')
      }
      menu.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }))
      await nextFrame()
      const acceptedLabels =
        label === 'Chat anheften' ? ['Chat anheften', 'Pin chat'] : ['Chat lösen', 'Unpin chat']
      const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
        acceptedLabels.includes(item.textContent?.trim() ?? '')
      )
      if (!item) {
        throw new Error(`Missing menu action: ${label}`)
      }
      item.click()
      await nextFrame()
    }
    await move('Chat anheften')
    if (!findRow()?.closest('[data-sidebar-global-pins]')) {
      throw new Error('Pinned chat did not move into the global section')
    }
    if (frame.querySelectorAll(`[data-sidebar-chat-row="${key}"]`).length !== 1) {
      throw new Error('Pinning duplicated the chat')
    }
    await move('Chat lösen')
    if (!findRow()?.closest('[data-worktree-card-surface]')) {
      throw new Error('Unpinned chat did not return to its project')
    }
  }
})

export const collapsedWorkspace = defineFixture({
  width: 280,
  store: fixtureState,
  setup: resetSidebarFixture,
  render: () => <Navigation />,
  interact: (frame) =>
    frame
      .querySelector<HTMLButtonElement>(
        '[data-sidebar-workspace-header] button[aria-expanded="true"]'
      )
      ?.click()
})

export const childAgents = defineFixture({
  width: 360,
  store: fixtureState,
  setup: resetSidebarFixture,
  render: () => <Navigation />,
  interact: expandChildrenThroughPointer
})

const importedAgents: AiVaultSession['agent'][] = ['codex', 'claude']
const importedSessions: AiVaultSession[] = importedAgents.map((agent) => ({
  id: `external-${agent}`,
  sessionId: `external-${agent}`,
  agent,
  executionHostId: 'local',
  title: agent === 'codex' ? 'SKY JOBSCREATOR' : 'Design und Konfiguration',
  cwd: workspace.path,
  branch: null,
  model: null,
  filePath: `/fixture/${agent}.jsonl`,
  codexHome: null,
  createdAt: null,
  updatedAt: null,
  modifiedAt: new Date().toISOString(),
  messageCount: 12,
  totalTokens: 0,
  previewMessages: [],
  queuedMessageCount: 0,
  subagentTranscriptCount: 0,
  resumeCommand: '',
  subagent: null
}))
export const linkedHistory = defineFixture({
  width: 320,
  store: {
    ...fixtureState,
    unifiedTabsByWorktree: {},
    agentStatusByPaneKey: {},
    sidebarChatGroupsByWorktree: {
      [workspaceId]: {
        groups: [],
        assignments: {},
        collapsed: [],
        sources: [
          { agent: 'codex', path: workspace.path, executionHostId: 'local' },
          { agent: 'claude', path: workspace.path, executionHostId: 'local' }
        ]
      }
    }
  },
  setup: () =>
    useSidebarChatHistory.setState({
      sessions: importedSessions,
      structure: { projects: [], assignments: {}, pinned: ['external-codex'], available: true }
    }),
  render: () => <Navigation />
})
