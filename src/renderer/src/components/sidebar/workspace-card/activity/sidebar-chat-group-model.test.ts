import { expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { visibleSidebarChats } from './sidebar-chat-group-model'

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
