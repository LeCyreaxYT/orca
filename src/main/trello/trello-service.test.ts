import { describe, expect, it } from 'vitest'
import { TrelloService } from './trello-service'
import { TrelloStore, type TrelloStateStorage } from './trello-store'
import type { TrelloCall } from './trello-read'
import type { TrelloCard } from '../../shared/trello/trello-types'

const REQUEST = '10000000-0000-4000-8000-000000000001'
const REVIEW = '10000000-0000-4000-8000-000000000002'

function setup() {
  let saved: string | null = null
  const storage: TrelloStateStorage = {
    read: () => saved,
    write: (value) => {
      saved = value
    }
  }
  const lists = [
    { id: 'planned', name: '04 – Geplant' },
    { id: 'implementation', name: '05 – In Umsetzung' },
    { id: 'review', name: '06 – Test & Abnahme' },
    { id: 'done', name: '07 – Fertig' },
    { id: 'other', name: 'Alternative' }
  ]
  const board = { id: 'board-a', name: 'Example project', url: 'https://trello.com/b/Example1' }
  const initial: TrelloCard = {
    id: 'card-a',
    boardId: 'board-a',
    listId: 'planned',
    name: 'Preserve the customer workflow',
    url: 'https://trello.com/c/Example1',
    complete: false,
    hasDescription: true,
    commentCount: 0,
    hasChecklists: true,
    checklistsComplete: true,
    description: '## Ziel\nOriginal template and accepted historical evidence.',
    checklists: [
      {
        id: 'checklist-a',
        name: 'Planung · Umsetzung · Testing',
        checkItems: [
          { id: 'historical', name: 'Previously accepted result', state: 'COMPLETE' },
          { id: 'new-check', name: 'Specific new verification', state: 'INCOMPLETE' }
        ]
      }
    ],
    comments: [],
    commentsHasMore: false,
    checklistDone: 1,
    checklistTotal: 2
  }
  const cards = new Map<string, TrelloCard>([['card-a', initial]])
  let lostCommentReply = false
  let failChecklist = false
  const call: TrelloCall = async (tool, args) => {
    const card = cards.get(String(args.cardIdOrUrl ?? args.cardId))
    if (tool === 'trelloReadBoard') {
      return structuredClone(board)
    }
    if (tool === 'trelloReadCard' && args.action === 'list_by_board') {
      return {
        lists: lists.map((list) => ({
          ...list,
          cards: [...cards.values()].filter((row) => row.listId === list.id)
        })),
        hasNextPage: false
      }
    }
    if (tool === 'trelloReadCard') {
      if (!card) {
        throw new Error('Card not found')
      }
      return structuredClone(card)
    }
    if (tool === 'trelloWriteCard' && args.action === 'move' && card) {
      card.listId = String(args.listId)
      return structuredClone(card)
    }
    if (tool === 'trelloWriteCard' && args.action === 'add_comment' && card) {
      const comment = { id: `note-${card.comments.length}`, text: String(args.text) }
      card.comments.push(comment)
      if (lostCommentReply) {
        throw new Error('Reply lost after the note was saved')
      }
      return comment
    }
    if (tool === 'trelloWriteCard' && args.action === 'create') {
      const id = `created-${cards.size}`
      const created = {
        ...structuredClone(initial),
        id,
        listId: String(args.listId),
        name: String(args.name),
        description: String(args.desc),
        checklists: [],
        comments: []
      }
      cards.set(id, created)
      return structuredClone(created)
    }
    if (tool === 'trelloWriteChecklist' && args.action === 'create' && card) {
      if (failChecklist) {
        throw new Error('Checklist response unavailable')
      }
      const checklist = { id: `new-checklist-${card.id}`, name: String(args.name), checkItems: [] }
      card.checklists.push(checklist)
      return checklist
    }
    if (tool === 'trelloWriteChecklist') {
      const checklist = [...cards.values()]
        .flatMap((row) => row.checklists)
        .find((row) => row.id === args.checklistId)
      if (!checklist) {
        throw new Error('Checklist not found')
      }
      if (args.action === 'add_item') {
        checklist.checkItems.push({
          id: `item-${checklist.checkItems.length}`,
          name: String(args.text),
          state: 'INCOMPLETE'
        })
      } else {
        const item = checklist.checkItems.find((row) => row.id === args.itemId)
        if (!item) {
          throw new Error('Check item not found')
        }
        item.state = args.checked ? 'COMPLETE' : 'INCOMPLETE'
      }
      return {}
    }
    throw new Error(`Unexpected Trello operation: ${tool}`)
  }
  const reopen = () =>
    new TrelloService(new TrelloStore('unused-with-memory-storage', storage), call)
  return {
    service: reopen(),
    reopen,
    cards,
    initial,
    loseReply: () => {
      lostCommentReply = true
    },
    failChecklist: () => {
      failChecklist = true
    }
  }
}

describe('native Trello workflow', () => {
  it('preserves the template and historical checks while delivering work for user acceptance', async () => {
    const { service, cards } = setup()
    const { run } = await service.prepare('card-a', 'folder:scripts')
    await service.start(run.id)
    const result = await service.progress(
      {
        requestId: REQUEST,
        runId: run.id,
        summary: 'Implemented the agreed change.',
        evidence: 'Build passed; manual acceptance remains.',
        checks: [{ checklistId: 'checklist-a', itemId: 'new-check', checked: true }]
      },
      true
    )
    expect(result.description).toBe('## Ziel\nOriginal template and accepted historical evidence.')
    expect(result.listId).toBe('review')
    expect(result.checklists[0]?.checkItems.map((item) => item.state)).toEqual([
      'COMPLETE',
      'COMPLETE'
    ])
    expect(result.comments[0]?.text).toContain('manual acceptance remains')
    expect(service.run(run.id).phase).toBe('review')
    expect(cards.get('card-a')?.listId).toBe('review')
    await service.accept(run.id)
    expect(cards.get('card-a')?.listId).toBe('done')
  })

  it('keeps a linked native chat and its original lane policy across reopening', async () => {
    const { service, reopen, cards } = setup()
    const { run } = await service.prepare('card-a', 'folder:scripts')
    service.bind(run.id, 'session-a', 'tab-a', 'codex')
    await service.configure('board-a', { implementation: 'other', review: 'review', done: 'done' })
    const resumed = reopen()
    expect(resumed.run(run.id)).toMatchObject({
      sessionId: 'session-a',
      tabId: 'tab-a',
      worktreeId: 'folder:scripts'
    })
    await resumed.start(run.id)
    expect(cards.get('card-a')?.listId).toBe('implementation')
  })

  it('refuses stale acceptance after the card was sent back for more work', async () => {
    const { service, initial } = setup()
    const { run } = await service.prepare('card-a', 'folder:scripts')
    await service.progress(
      {
        requestId: REVIEW,
        runId: run.id,
        summary: 'Ready for review.',
        evidence: 'Source checked; user test pending.'
      },
      true
    )
    initial.listId = 'implementation'
    await expect(service.accept(run.id)).rejects.toThrow('moved out of Test/Acceptance')
    expect(initial.listId).toBe('implementation')
  })

  it('does not repost a note after a lost reply, including after reopening Orca', async () => {
    const { service, reopen, initial, loseReply } = setup()
    const { run } = await service.prepare('card-a', 'folder:scripts')
    const input = {
      requestId: REQUEST,
      runId: run.id,
      summary: 'Checkpoint.',
      evidence: 'Verified specific behavior.'
    }
    loseReply()
    await expect(service.progress(input)).rejects.toThrow('Reply lost')
    await expect(reopen().progress(input)).rejects.toThrow('unconfirmed')
    expect(initial.comments.map((note) => note.text)).toHaveLength(1)
    expect(service.store.read().operations[REQUEST]?.state).toBe('unknown')
  })

  it('replays confirmed progress without duplicating the external note', async () => {
    const { service, initial } = setup()
    const { run } = await service.prepare('card-a', 'folder:scripts')
    const input = {
      requestId: REQUEST,
      runId: run.id,
      summary: 'Checkpoint.',
      evidence: 'Verified specific behavior.'
    }
    await service.progress(input)
    await service.progress(input)
    expect(initial.comments).toHaveLength(1)
  })

  it('rejects foreign checklist items before posting progress', async () => {
    const { service, initial } = setup()
    const { run } = await service.prepare('card-a', 'folder:scripts')
    await expect(
      service.progress({
        requestId: REQUEST,
        runId: run.id,
        summary: 'Checkpoint.',
        evidence: 'A test ran.',
        checks: [{ checklistId: 'foreign', itemId: 'foreign-item', checked: true }]
      })
    ).rejects.toThrow('no longer belongs')
    expect(initial.comments).toEqual([])
    expect(initial.checklists[0]?.checkItems[1]?.state).toBe('INCOMPLETE')
    expect(service.store.read().operations[REQUEST]?.state).toBe('rejected')
  })

  it('copies template structure with new unchecked items instead of accepted evidence', async () => {
    const { service } = setup()
    const result = await service.create({
      requestId: REQUEST,
      boardId: 'board-a',
      listId: 'planned',
      name: 'New task',
      description: '## Ziel\nNew scope.',
      templateCardId: 'card-a'
    })
    expect(result.description).toBe('## Ziel\nNew scope.')
    expect(result.checklists[0]?.name).toBe('Planung · Umsetzung · Testing')
    expect(result.checklists[0]?.checkItems.map((item) => item.state)).toEqual([
      'INCOMPLETE',
      'INCOMPLETE'
    ])
    expect(result.comments).toEqual([])
  })

  it('refuses creating a Done card as an alternative to user acceptance', async () => {
    const { service, cards } = setup()
    await expect(
      service.create({
        requestId: REQUEST,
        boardId: 'board-a',
        listId: 'done',
        name: 'Bypass',
        description: ''
      })
    ).rejects.toThrow('user acceptance')
    expect([...cards.keys()]).toEqual(['card-a'])
  })

  it('retains the created card identity when a later template step fails', async () => {
    const { service, reopen, cards, failChecklist } = setup()
    const input = {
      requestId: REQUEST,
      boardId: 'board-a',
      listId: 'planned',
      name: 'New task',
      description: 'New scope.'
    }
    failChecklist()
    await expect(service.create(input)).rejects.toThrow('Checklist response unavailable')
    expect(service.store.read().operations[REQUEST]).toMatchObject({
      state: 'unknown',
      result: { cardId: 'created-1' }
    })
    await expect(reopen().create(input)).rejects.toThrow('unconfirmed')
    expect([...cards.keys()]).toEqual(['card-a', 'created-1'])
  })
})
