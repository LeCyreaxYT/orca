import { expect, it } from 'vitest'
import { createCodexHistoryCollector } from './journal-codex-history'

it('keeps an in-turn question reply after the question and retains the original opener', () => {
  const collector = createCodexHistoryCollector('chat', { inlineHeadBytes: 16384 }, 1048576)
  const record = (ordinal: number, payload: Record<string, unknown>) =>
    collector.record({
      segmentId: 'thread',
      paginated: true,
      ordinal,
      offset: ordinal,
      selected: true,
      recordId: `thread:${ordinal}`,
      record: { type: 'event_msg', timestamp: `2026-11-11T21:00:0${ordinal}.000Z`, payload }
    })
  record(0, { type: 'task_started', turn_id: 'turn' })
  record(1, {
    type: 'item_completed',
    turn_id: 'turn',
    item: {
      type: 'UserMessage',
      id: 'opener',
      content: [{ type: 'text', text: 'Prepare the release' }]
    }
  })
  record(2, {
    type: 'item_completed',
    turn_id: 'turn',
    item: {
      type: 'AgentMessage',
      id: 'call_upload',
      delivery: 'async',
      content: [{ type: 'Text', text: 'Upload complete?' }],
      questions: [{ title: 'Upload complete?', options: ['Yes', 'No'] }]
    }
  })
  record(3, {
    type: 'item_completed',
    turn_id: 'turn',
    item: {
      type: 'UserMessage',
      id: 'reply',
      content: [{ type: 'text', text: 'Yes, uploaded' }]
    }
  })
  record(4, {
    type: 'item_completed',
    turn_id: 'turn',
    item: {
      type: 'AgentMessage',
      id: 'confirmed',
      content: [{ type: 'Text', text: 'Upload confirmed' }]
    }
  })
  const items = collector.items()
  expect(
    items.map((item) => (item.body.kind === 'message' ? item.body.blocks[0] : item.body.kind))
  ).toEqual([
    'turn',
    { type: 'text', text: 'Prepare the release' },
    { type: 'text', text: 'Upload complete?' },
    { type: 'text', text: 'Yes, uploaded' },
    { type: 'text', text: 'Upload confirmed' }
  ])
  expect(items[0]?.body).toMatchObject({ userItemId: 'legacy:codex:chat:thread%3A1' })
})
