import { expect, it } from 'vitest'
import { mappedSidebarChatWorkspace } from './sidebar-chat-sources'
import {
  EMPTY_SIDEBAR_CHAT_GROUPS,
  type SidebarChatGroupsByWorktree,
  type SidebarChatSource
} from './sidebar-chat-groups'
import type { AiVaultSession } from './ai-vault/contracts/ai-vault-types'

const mappedAgents: SidebarChatSource['agent'][] = ['codex', 'claude']

const mappings: SidebarChatGroupsByWorktree = {
  broad: {
    ...EMPTY_SIDEBAR_CHAT_GROUPS,
    sources: [
      { agent: 'codex' as const, path: 'F:/Work', projectId: 'changelog', executionHostId: 'local' }
    ]
  },
  scripts: {
    ...EMPTY_SIDEBAR_CHAT_GROUPS,
    sources: mappedAgents.map((agent) => ({
      agent,
      path: 'F:/Work/Scripts',
      projectId: agent === 'codex' ? 'scripts-project' : undefined,
      executionHostId: 'local'
    }))
  }
}
const structure = {
  projects: [],
  assignments: { assigned: 'changelog', unmapped: 'not-linked' },
  pinned: [],
  available: true
}
const session = (overrides: Partial<AiVaultSession>): AiVaultSession => ({
  id: 'fixture-session',
  title: 'Fixture conversation',
  branch: null,
  model: null,
  filePath: '/fixture/session.jsonl',
  codexHome: null,
  createdAt: null,
  updatedAt: null,
  modifiedAt: '2026-11-10T00:00:00Z',
  messageCount: 1,
  totalTokens: 0,
  previewMessages: [],
  queuedMessageCount: 0,
  subagentTranscriptCount: 0,
  resumeCommand: '',
  agent: 'codex',
  sessionId: 'cwd-only',
  cwd: 'f:\\work\\scripts\\sky_jobs',
  executionHostId: 'local',
  subagent: null,
  ...overrides
})

it('uses explicit Codex project membership before overlapping folders and keeps unmapped projects unassigned', () => {
  expect(mappedSidebarChatWorkspace(session({ sessionId: 'assigned' }), mappings, structure)).toBe(
    'broad'
  )
  expect(
    mappedSidebarChatWorkspace(session({ sessionId: 'unmapped' }), mappings, structure)
  ).toBeNull()
  expect(mappedSidebarChatWorkspace(session({}), mappings, structure)).toBe('scripts')
})

it('keeps saved folder mappings when Codex migrates a project to a new ID', () => {
  const migrated = {
    ...structure,
    projects: [{ id: 'current-project', name: 'Changelogs', paths: ['F:/Work'] }],
    assignments: { assigned: 'current-project' }
  }
  expect(mappedSidebarChatWorkspace(session({ sessionId: 'assigned' }), mappings, migrated)).toBe(
    'broad'
  )
})

it('maps an unassigned Codex chat recorded with a Windows long-path prefix', () => {
  expect(
    mappedSidebarChatWorkspace(
      session({ cwd: '\\\\?\\F:\\Work\\Scripts\\sky_jobs' }),
      mappings,
      structure
    )
  ).toBe('scripts')
})

it('matches local Claude folders by path segment without capturing sibling folders, other hosts or subagents', () => {
  expect(mappedSidebarChatWorkspace(session({ agent: 'claude' }), mappings, structure)).toBe(
    'scripts'
  )
  expect(
    mappedSidebarChatWorkspace(
      session({ agent: 'claude', cwd: 'F:/Work/Scripts_Phone' }),
      mappings,
      structure
    )
  ).toBeNull()
  expect(
    mappedSidebarChatWorkspace(
      session({ agent: 'claude', executionHostId: 'runtime:other' }),
      mappings,
      structure
    )
  ).toBeNull()
  expect(
    mappedSidebarChatWorkspace(
      session({ subagent: { parentSessionId: 'parent', agentType: null, status: null } }),
      mappings,
      structure
    )
  ).toBeNull()
})

it('preserves distinct POSIX folder names on remote hosts', () => {
  const linux: SidebarChatGroupsByWorktree = {
    remote: {
      ...EMPTY_SIDEBAR_CHAT_GROUPS,
      sources: [{ agent: 'claude', path: '/work/Scripts', executionHostId: 'runtime:linux' }]
    }
  }
  expect(
    mappedSidebarChatWorkspace(
      session({ agent: 'claude', cwd: '/work/Scripts/job', executionHostId: 'runtime:linux' }),
      linux,
      structure
    )
  ).toBe('remote')
  expect(
    mappedSidebarChatWorkspace(
      session({ agent: 'claude', cwd: '/work/scripts/job', executionHostId: 'runtime:linux' }),
      linux,
      structure
    )
  ).toBeNull()
})

it('keeps an existing native chat in its workspace even when its Codex project is mapped elsewhere', () => {
  const native = session({
    sessionId: 'assigned',
    structuredSession: { workspaceId: 'scripts', sessionId: 'native' }
  })
  expect(
    mappedSidebarChatWorkspace(native, mappings, structure, [{ id: 'scripts', hostId: 'local' }])
  ).toBe('scripts')
  expect(
    mappedSidebarChatWorkspace(native, mappings, structure, [
      { id: 'scripts', hostId: 'runtime:other' }
    ])
  ).toBe('broad')
})
