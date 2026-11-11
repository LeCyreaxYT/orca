import { expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import {
  sidebarChatIdentity,
  sortSidebarChats,
  visibleSidebarChats
} from './sidebar-chat-group-model'

function row(id: string): DashboardAgentRow {
  return {
    paneKey: id,
    agentType: 'codex',
    state: 'idle',
    startedAt: 1,
    tab: {
      id,
      ptyId: null,
      worktreeId: 'scripts',
      title: id,
      customTitle: null,
      color: null,
      sortOrder: 0,
      createdAt: 1
    },
    entry: {
      paneKey: id,
      agentType: 'codex',
      worktreeId: 'scripts',
      state: 'done',
      prompt: id,
      updatedAt: 1,
      stateStartedAt: 1,
      stateHistory: []
    }
  }
}

it('keeps the selected chat and a parent with active children visible beyond the recent five', () => {
  const rows = ['one', 'two', 'three', 'four', 'five', 'quiet', 'selected', 'parent'].map(row)
  expect(
    visibleSidebarChats(rows, new Set(['selected']), new Map([['parent', 'working']]), false).map(
      (agent) => agent.paneKey
    )
  ).toEqual(['one', 'two', 'three', 'four', 'five', 'selected', 'parent'])
})

it('sorts resumed chats by provider activity instead of import time and obeys name sorting', () => {
  const older = row('older')
  older.tab.aiVaultTitle = { agent: 'codex', sessionId: 'old-provider', title: 'old prompt' }
  older.entry.updatedAt = 9_999
  const newer = row('newer')
  newer.tab.aiVaultTitle = { agent: 'codex', sessionId: 'new-provider', title: 'new prompt' }
  const rows = [{ agent: older }, { agent: newer }]
  const options = {
    sessions: new Map(),
    structure: {
      projects: [],
      assignments: {},
      pinned: [],
      available: true,
      titles: { 'old-provider': 'Alpha', 'new-provider': 'Zulu' },
      updatedAt: { 'old-provider': 100, 'new-provider': 200 }
    }
  }
  expect(
    sortSidebarChats(rows, { ...options, sortBy: 'recent' }).map(
      (item) => item.agent && sidebarChatIdentity(item.agent)
    )
  ).toEqual([
    '["history","local","codex","new-provider"]',
    '["history","local","codex","old-provider"]'
  ])
  expect(
    sortSidebarChats(rows, { ...options, sortBy: 'name' }).map((item) => item.agent?.paneKey)
  ).toEqual(['older', 'newer'])
})

it('does not promote an opened historical failure, while a running chat moves up until it finishes', () => {
  const older = row('older')
  older.tab.aiVaultTitle = { agent: 'codex', sessionId: 'old', title: 'Older' }
  older.entry.mainAgent = { state: 'done', stateStartedAt: 9000, outcome: 'unconfirmed' }
  const newer = row('newer')
  newer.tab.aiVaultTitle = { agent: 'codex', sessionId: 'new', title: 'Newer' }
  const options = {
    sortBy: 'smart' as const,
    sessions: new Map(),
    structure: {
      projects: [],
      assignments: {},
      pinned: [],
      available: true,
      updatedAt: { old: 100, new: 200 }
    }
  }
  const order = () =>
    sortSidebarChats([{ agent: older }, { agent: newer }], options).map(
      (item) => item.agent?.paneKey
    )
  expect(order()).toEqual(['newer', 'older'])
  delete older.entry.mainAgent
  older.state = 'working'
  older.entry.state = 'working'
  expect(order()).toEqual(['older', 'newer'])
  older.state = 'done'
  older.entry.state = 'done'
  expect(order()).toEqual(['newer', 'older'])
})
