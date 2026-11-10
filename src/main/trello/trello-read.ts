import { z } from 'zod'
import type {
  TrelloBoardOption,
  TrelloCard,
  TrelloCardSummary,
  TrelloChecklist,
  TrelloList
} from '../../shared/trello/trello-types'

export type TrelloCall = (tool: string, args: Record<string, unknown>) => Promise<unknown>
const IdName = z.object({ id: z.string().min(1), name: z.string() })
const BoardOption = IdName.extend({ url: z.string().url() })
const Checklist = IdName.extend({
  checkItems: z.array(IdName.extend({ state: z.string() })),
  checkItemsHasMore: z.boolean().optional()
})
const Card = IdName.extend({
  boardId: z.string(),
  listId: z.string(),
  url: z.string().url(),
  description: z.string().default(''),
  complete: z.boolean().default(false),
  checklists: z.array(Checklist).default([]),
  checklistsHasMore: z.boolean().optional(),
  comments: z.array(z.object({ id: z.string(), text: z.string() })).default([]),
  commentsHasMore: z.boolean().default(false)
})
const Page = z.object({
  nextCursor: z.string().nullable().optional(),
  hasMore: z.boolean().optional(),
  hasNextPage: z.boolean().optional(),
  pageInfo: z
    .object({ hasNextPage: z.boolean(), endCursor: z.string().nullable().optional() })
    .optional()
})

function nextPage(raw: unknown): string | null {
  const page = Page.parse(raw)
  if (!(page.hasMore || page.hasNextPage || page.pageInfo?.hasNextPage)) {
    return null
  }
  const cursor = page.nextCursor ?? page.pageInfo?.endCursor
  if (!cursor) {
    throw new Error('Trello returned an incomplete page without a continuation cursor.')
  }
  return cursor
}

function summary(card: z.infer<typeof Card>): TrelloCardSummary {
  const complete =
    !card.checklistsHasMore && !card.checklists.some((list) => list.checkItemsHasMore)
  const items = complete ? card.checklists.flatMap((list) => list.checkItems) : []
  return {
    id: card.id,
    boardId: card.boardId,
    listId: card.listId,
    name: card.name,
    url: card.url,
    complete: card.complete,
    hasDescription: Boolean(card.description.trim()),
    commentCount: card.comments.length,
    commentsHasMore: card.commentsHasMore,
    hasChecklists: card.checklists.length > 0 || Boolean(card.checklistsHasMore),
    checklistsComplete: complete,
    checklistTotal: items.length,
    checklistDone: items.filter((item) => item.state.toUpperCase() === 'COMPLETE').length
  }
}

export class TrelloRead {
  constructor(readonly call: TrelloCall) {}

  private async pages<T>(
    read: (cursor?: string) => Promise<unknown>,
    collect: (raw: unknown) => T[]
  ): Promise<T[]> {
    const rows: T[] = []
    const seen = new Set<string>()
    let cursor: string | undefined
    for (let page = 0; page < 100; page++) {
      const raw = await read(cursor)
      rows.push(...collect(raw))
      const next = nextPage(raw)
      if (!next) {
        return rows
      }
      if (seen.has(next)) {
        throw new Error('Trello repeated a continuation cursor.')
      }
      seen.add(next)
      cursor = next
    }
    throw new Error('Trello returned too many pages. Narrow the board selection.')
  }

  boards(): Promise<TrelloBoardOption[]> {
    return this.pages(
      (cursor) =>
        this.call('trelloReadBoard', {
          action: 'list',
          filter: 'open',
          limit: 50,
          ...(cursor ? { cursor } : {})
        }),
      (raw) => z.object({ boards: z.array(BoardOption) }).parse(raw).boards
    )
  }

  async board(
    boardId: string
  ): Promise<TrelloBoardOption & { lists: TrelloList[]; cards: TrelloCardSummary[] }> {
    const board = BoardOption.parse(await this.call('trelloReadBoard', { action: 'get', boardId }))
    const lists = await this.pages(
      (cursor) =>
        this.call('trelloReadCard', {
          action: 'list_by_board',
          boardIdOrUrl: board.id,
          filter: 'open',
          limit: 50,
          ...(cursor ? { cursor } : {})
        }),
      (raw) =>
        z.object({ lists: z.array(IdName.extend({ cards: z.array(Card) })) }).parse(raw).lists
    )
    const merged = new Map<
      string,
      { id: string; name: string; cards: Map<string, TrelloCardSummary> }
    >()
    for (const list of lists) {
      let target = merged.get(list.id)
      if (!target) {
        target = { id: list.id, name: list.name, cards: new Map() }
        merged.set(list.id, target)
      }
      for (const card of list.cards) {
        target.cards.set(card.id, summary(card))
      }
    }
    return {
      ...board,
      lists: [...merged.values()].map(({ id, name }) => ({ id, name })),
      cards: [...merged.values()].flatMap((list) => [...list.cards.values()])
    }
  }

  async card(cardId: string): Promise<TrelloCard> {
    const card = Card.parse(
      await this.call('trelloReadCard', { action: 'get', cardIdOrUrl: cardId })
    )
    let checklists: TrelloChecklist[] = card.checklists
    if (card.checklistsHasMore || card.checklists.some((list) => list.checkItemsHasMore)) {
      checklists = await this.pages(
        (cursor) =>
          this.call('trelloReadChecklist', {
            action: 'list_by_card',
            cardId: card.id,
            limit: 100,
            ...(cursor ? { cursor } : {})
          }),
        (raw) => z.object({ checklists: z.array(Checklist) }).parse(raw).checklists
      )
      if (checklists.some((list) => 'checkItemsHasMore' in list && list.checkItemsHasMore)) {
        throw new Error(
          'Trello did not return the complete checklist. Read it in Trello before continuing.'
        )
      }
    }
    return {
      ...summary({ ...card, checklists, checklistsHasMore: false }),
      description: card.description,
      checklists,
      comments: card.comments,
      commentsHasMore: card.commentsHasMore
    }
  }
}
