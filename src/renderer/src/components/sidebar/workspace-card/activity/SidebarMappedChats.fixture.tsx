import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import { makeRepo, makeWorktree } from '../../../worktree-jump/worktree-jump-palette-test-fixtures'
import WorktreeCard from '../surface/WorktreeCard'
import { WorkspaceNewChatButton } from './WorkspaceNewChatButton'
import { SidebarPinnedChats } from '../../chat-sources/SidebarPinnedChats'
import type { AppState } from '@/store/types'
import { structuredAgentSessionPaneKey } from '../../../../../../shared/agent-session/view/structured-agent-session-projection'
import { publishSidebarChatHistory } from '../../chat-sources/sidebar-chat-history-store'
import type { Tab } from '../../../../../../shared/tab-types'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { AgentStatusEntry } from '../../../../../../shared/agent-status/contracts/agent-status-types'
import { sidebarHistoryChatId } from '../../../../../../shared/sidebar-chat-sources'

const repo = makeRepo()
const changelogs = makeWorktree('mapped-changelogs', 'Changelogs', {
  repoId: repo.id,
  displayName: 'Changelogs',
  path: 'F:/Work'
})
const scripts = makeWorktree('mapped-scripts', 'Scripts', {
  repoId: repo.id,
  displayName: 'Scripts',
  path: 'F:/Work/Scripts'
})
const tabs: Tab[] = ['parent', 'child'].map((id, index) => ({
  id: `mapped-${id}`,
  entityId: `11111111-1111-4111-8111-00000000000${index}`,
  contentType: 'agent-session',
  agentSessionAgent: 'codex',
  worktreeId: changelogs.id,
  groupId: 'mapped-tabs',
  executionHostId: 'local',
  label: index === 0 ? 'Raw first prompt' : 'Build prüfen',
  customLabel: null,
  aiVaultTitle: { agent: 'codex', sessionId: id, title: 'Raw first prompt' },
  color: null,
  sortOrder: index,
  createdAt: 1
}))
const paneKeys = tabs.map((tab) => structuredAgentSessionPaneKey(tab.id, tab.entityId))
const entries: AgentStatusEntry[] = tabs.map((tab, index) => ({
  paneKey: paneKeys[index],
  worktreeId: changelogs.id,
  agentType: 'codex',
  state: 'done',
  prompt: tab.label,
  terminalTitle: tab.label,
  updatedAt: 9_999_999,
  stateStartedAt: 1,
  stateHistory: [],
  ...(index === 1
    ? {
        orchestration: {
          taskId: 'mapped-task',
          dispatchId: 'mapped-dispatch',
          parentPaneKey: paneKeys[0]
        }
      }
    : {})
}))
const imported: AiVaultSession = {
  id: 'mapped-newest',
  sessionId: 'newest',
  agent: 'codex',
  executionHostId: 'local',
  title: 'Old preview title',
  cwd: changelogs.path,
  branch: null,
  model: null,
  filePath: '/fixture/newest.jsonl',
  codexHome: null,
  createdAt: null,
  updatedAt: '2026-11-11T10:00:00Z',
  modifiedAt: '2026-11-11T10:00:00Z',
  messageCount: 20,
  totalTokens: 0,
  previewMessages: [],
  queuedMessageCount: 0,
  subagentTranscriptCount: 0,
  resumeCommand: '',
  subagent: null
}
const store: Partial<AppState> = {
  repos: [repo],
  worktreesByRepo: { [repo.id]: [changelogs, scripts] },
  unifiedTabsByWorktree: { [changelogs.id]: tabs },
  agentStatusByPaneKey: Object.fromEntries(entries.map((entry) => [entry.paneKey, entry])),
  agentActivityDisplayMode: 'full' as const,
  sortBy: 'recent' as const,
  worktreeCardProperties: ['inline-agents', 'branch'],
  sidebarChatGroupsByWorktree: {
    [changelogs.id]: {
      groups: [],
      assignments: {},
      collapsed: [],
      sources: [
        {
          agent: 'codex' as const,
          path: changelogs.path,
          projectId: 'legacy',
          executionHostId: 'local' as const
        }
      ]
    },
    [scripts.id]: { groups: [], assignments: {}, collapsed: [] }
  }
}
function setup() {
  publishSidebarChatHistory([imported], {
    projects: [{ id: 'legacy', name: 'Changelogs', paths: [changelogs.path] }],
    assignments: { newest: 'legacy', parent: 'legacy' },
    pinned: [],
    available: true,
    titles: {
      newest: 'Patch-Releases vorbereiten und veröffentlichen',
      parent: 'Gemeinsames Update vorbereiten'
    },
    updatedAt: { newest: 2_000, parent: 1_000 }
  })
}
function Navigation() {
  return (
    <div className="@container/sidebar bg-worktree-sidebar p-3 text-worktree-sidebar-foreground">
      <WorkspaceNewChatButton worktreeId={changelogs.id} labelled />
      <SidebarPinnedChats />
      <div className="px-2 pb-2 pt-6 text-xs text-muted-foreground">Projekte</div>
      {[changelogs, scripts].map((workspace) => (
        <section key={workspace.id} data-mapped-workspace={workspace.id} className="mb-1">
          <WorktreeCard
            worktree={workspace}
            repo={repo}
            isActive={false}
            nativeDragEnabled={false}
          />
        </section>
      ))}
    </div>
  )
}
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
export const recent = defineFixture({ width: 360, store, setup, render: () => <Navigation /> })
export const movedParent = defineFixture({
  width: 360,
  store,
  setup,
  render: () => <Navigation />,
  interact: async (frame) => {
    const rows = frame
      .querySelector('[data-mapped-workspace="mapped-changelogs"]')
      ?.querySelectorAll('[data-sidebar-chat-row]')
    if (rows?.[0].textContent?.trim() !== 'Patch-Releases vorbereiten und veröffentlichen') {
      throw new Error('Newest provider conversation is not first')
    }
    const row = frame.querySelector(`[data-sidebar-chat-row='${paneKeys[0]}']`)
    const menu = row
      ?.closest('.group\\/chat-row')
      ?.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')
    if (!menu) {
      throw new Error('Chat move menu is missing')
    }
    menu.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }))
    await nextFrame()
    const submenu = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-trigger"]')
    submenu?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextFrame()
    const destination = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
      (item) => item.textContent?.trim() === 'Scripts'
    )
    if (!destination) {
      throw new Error('Destination workspace is missing')
    }
    destination.click()
    await nextFrame()
    const target = frame.querySelector('[data-mapped-workspace="mapped-scripts"]')
    if (!target?.textContent?.includes('Gemeinsames Update vorbereiten')) {
      throw new Error('Moved chat is missing at its destination')
    }
    if (frame.querySelectorAll(`[data-sidebar-chat-row='${paneKeys[0]}']`).length !== 1) {
      throw new Error('Moved chat was duplicated')
    }
    const state = useAppStore.getState()
    if (
      state.unifiedTabsByWorktree[changelogs.id]?.[0].id !== 'mapped-parent' ||
      state.unifiedTabsByWorktree[scripts.id]?.length
    ) {
      throw new Error('Logical move changed runtime ownership')
    }
    const disclosure = target.querySelector<HTMLButtonElement>('.agent-child-disclosure button')
    disclosure?.click()
    await nextFrame()
    if (!target.textContent?.includes('Build prüfen')) {
      throw new Error('Moved parent lost its child agent')
    }
    state.setSortBy('name')
    state.moveSidebarChatToWorkspace(changelogs.id, scripts.id, sidebarHistoryChatId(imported))
    await nextFrame()
    const titles = [...target.querySelectorAll('[data-sidebar-chat-row]')].map((element) =>
      element.textContent?.trim()
    )
    if (
      titles[0] !== 'Gemeinsames Update vorbereiten' ||
      !titles.at(-1)?.includes('Patch-Releases')
    ) {
      throw new Error('Name sorting did not apply after moving')
    }
  }
})
