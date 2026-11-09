import { expect, it } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createFixture } from '../../agent-session-journal/store-lifecycle/journal-store-contract-test-fixture'
import {
  readRefreshedAgentSessionHistory,
  refreshAgentSessionJournal
} from './structured-agent-session-history-refresh'
import { agentSessionConversationView } from '../../../../shared/agent-session/lifecycle/agent-session-conversation-view'
import { agentSessionRecordFixture } from '../../../../shared/agent-session/lifecycle/agent-session-record.test-fixture'
import { directoryTranscriptImport } from '../../structured-agent-cli-conversations'
import type { JournalReplacementItem } from '../../agent-session-journal/context-epochs/journal-epoch-replacement'

const fixture = createFixture()
const unchanged = () => {}

it('reads a newer external Claude transcript after adoption left a managed copy behind', async () => {
  const managed = join(fixture.root, 'managed')
  const external = join(fixture.root, 'external')
  await mkdir(managed)
  await mkdir(external)
  const record = agentSessionRecordFixture()
  record.accountHome = { variable: 'CLAUDE_CONFIG_DIR', path: managed }
  const source = (text: string, timestamp: string) =>
    JSON.stringify({
      type: 'assistant',
      uuid: 'reply-1',
      sessionId: 'provider-session-alpha-1',
      cwd: fixture.root,
      timestamp,
      message: { role: 'assistant', content: [{ type: 'text', text }] }
    })
  await writeFile(join(managed, 'source.jsonl'), source('Old copied reply', '2026-11-09T10:00:00Z'))
  await writeFile(
    join(external, 'source.jsonl'),
    source('New externally saved reply', '2026-11-09T10:01:00Z')
  )
  const items = await readRefreshedAgentSessionHistory({
    record: agentSessionConversationView(record),
    importer: directoryTranscriptImport({
      accountHomeCandidates: () => [managed, external],
      conversationStore: ({ accountHomePath }) => accountHomePath,
      findTranscript: async ({ store }) => join(store, 'source.jsonl')
    }),
    workspaceCwd: fixture.root,
    launchEnv: {},
    signal: new AbortController().signal
  })
  expect(items.map((item) => item.body)).toEqual([
    {
      kind: 'message',
      role: 'assistant',
      blocks: [{ type: 'text', text: 'New externally saved reply' }]
    }
  ])
})

function sourceItem(ordinal: number, text: string): JournalReplacementItem {
  return {
    identity: fixture.item(ordinal),
    body: fixture.body(text),
    ownerFence: 0,
    observedAt: 100,
    turnScope: { kind: 'thread' }
  }
}

it('shows external additions and completed text once, preserving native messages and removed history', async () => {
  const journal = await fixture.open()
  await journal.replaceEpochItems('legacy_import', 1, [
    sourceItem(1, 'Partial answer'),
    sourceItem(2, 'Removed answer')
  ])
  await journal.appendLifecycleBatch({
    settlementId: 'remove-old-answer',
    fence: 2,
    mutations: [{ kind: 'tombstone', identity: fixture.item(2) }]
  })
  await journal.appendItem(fixture.item(3), fixture.body('Written in Orca'), {
    fence: 2,
    ownerFence: 2,
    turnScope: { kind: 'thread' }
  })
  const before = journal.cursor()
  const refresh = () =>
    refreshAgentSessionJournal({
      journal,
      fence: 2,
      assertCurrent: unchanged,
      items: [
        sourceItem(1, 'Complete answer'),
        sourceItem(2, 'Removed answer'),
        sourceItem(3, 'Older transcript copy'),
        sourceItem(4, 'Continued in Codex')
      ]
    })
  expect(await refresh()).toBe(2)
  const after = journal.cursor()
  expect(await refresh()).toBe(0)
  expect(journal.cursor()).toEqual(after)
  expect(after.epoch).toBe(before.epoch)
  expect(journal.snapshot().items.map((item) => item.body)).toEqual([
    { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'Complete answer' }] },
    { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'Written in Orca' }] },
    { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text: 'Continued in Codex' }] }
  ])
})

it('rejects an oversized refresh before publishing any partial conversation', async () => {
  const journal = await fixture.open()
  await expect(
    refreshAgentSessionJournal({
      journal,
      fence: 1,
      assertCurrent: unchanged,
      items: Array.from({ length: 1_025 }, (_, index) => sourceItem(index, 'External answer'))
    })
  ).rejects.toThrow('too-large')
  expect(journal.snapshot().items).toEqual([])
})

it('does not publish history after the conversation changed during the read', async () => {
  const journal = await fixture.open()
  await expect(
    refreshAgentSessionJournal({
      journal,
      fence: 1,
      assertCurrent: () => {
        throw new Error('The conversation changed')
      },
      items: [sourceItem(1, 'Stale answer')]
    })
  ).rejects.toThrow('The conversation changed')
  expect(journal.snapshot().items).toEqual([])
})
