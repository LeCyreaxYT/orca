import { describe, expect, it } from 'vitest'
import { TrelloRead } from './trello-read'

describe('Trello board pagination', () => {
  it('uses parent board and list IDs while merging card pages without duplicates', async () => {
    const card = (id: string) => ({
      id,
      name: id,
      boardId: null,
      listId: null,
      url: 'https://trello.com/c/Example1'
    })
    const read = new TrelloRead(async (tool, args) => {
      if (tool === 'trelloReadBoard') {
        return { id: 'board', name: 'Demo', url: 'https://trello.com/b/Example1' }
      }
      return args.cursor
        ? {
            lists: [{ id: 'planned', name: 'Planned', cards: [card('a'), card('b')] }],
            hasNextPage: false
          }
        : {
            lists: [
              { id: 'planned', name: 'Planned', cards: [card('a')] },
              { id: 'review', name: 'Review', cards: [] }
            ],
            hasNextPage: true,
            nextCursor: 'page-2'
          }
    })
    const board = await read.board('board')
    expect(board.lists.map((list) => list.id)).toEqual(['planned', 'review'])
    expect(board.cards.map((card) => card.id)).toEqual(['a', 'b'])
    expect(board.cards[0]).toMatchObject({ boardId: 'board', listId: 'planned' })
  })

  it('refuses an incomplete page instead of presenting it as the complete board', async () => {
    const read = new TrelloRead(async () => ({ boards: [], pageInfo: { hasNextPage: true } }))
    await expect(read.boards()).rejects.toThrow('continuation cursor')
  })
})
