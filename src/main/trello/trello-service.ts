import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { TrelloStore } from './trello-store'
import { TrelloRead, type TrelloCall } from './trello-read'
import { inferTrelloWorkflow, trelloTaskPrompt } from '../../shared/trello/trello-workflow'
import type {
  TrelloBoard,
  TrelloProgress,
  TrelloRun,
  TrelloWorkflow
} from '../../shared/trello/trello-types'

export class TrelloService {
  readonly read: TrelloRead
  private writes: Promise<unknown> = Promise.resolve()

  constructor(
    readonly store: TrelloStore,
    call: TrelloCall
  ) {
    this.read = new TrelloRead(call)
  }

  private serialize<T>(write: () => Promise<T>): Promise<T> {
    const result = this.writes.then(write)
    this.writes = result.catch(() => {})
    return result
  }

  async board(boardId: string): Promise<TrelloBoard> {
    const board = await this.read.board(boardId)
    const workflow = this.store.read().workflows[board.id] ?? inferTrelloWorkflow(board.lists)
    return { ...board, workflow }
  }

  async configure(boardId: string, workflow: TrelloWorkflow) {
    const board = await this.read.board(boardId)
    const ids = Object.values(workflow)
    if (new Set(ids).size !== 3 || !ids.every((id) => board.lists.some((list) => list.id === id))) {
      throw new Error('Choose three different lists from this Trello board.')
    }
    this.store.update((state) => {
      state.workflows[board.id] = workflow
      state.selectedBoardId = board.id
    })
    return workflow
  }

  private async workflow(boardId: string): Promise<TrelloWorkflow> {
    const board = await this.board(boardId)
    if (
      !board.workflow ||
      !Object.values(board.workflow).every((id) => board.lists.some((list) => list.id === id))
    ) {
      throw new Error('Map Implementation, Test/Acceptance and Done to this board’s lists first.')
    }
    this.store.update((state) => {
      state.workflows[board.id] = board.workflow!
    })
    return board.workflow
  }

  run(runId: string): TrelloRun {
    const run = this.store.read().runs[runId]
    if (!run) {
      throw new Error('This Trello run does not exist on the selected Orca host.')
    }
    return run
  }

  async prepare(cardId: string, worktreeId: string) {
    const card = await this.read.card(cardId)
    const workflow = await this.workflow(card.boardId)
    const run: TrelloRun = {
      id: randomUUID(),
      cardId: card.id,
      boardId: card.boardId,
      worktreeId,
      phase: 'prepared',
      workflow,
      createdAt: new Date().toISOString()
    }
    this.store.update((state) => {
      state.runs[run.id] = run
      state.selectedBoardId = card.boardId
    })
    return { run, prompt: trelloTaskPrompt(run.id, card) }
  }

  bind(runId: string, sessionId: string, tabId: string, agent: string) {
    const run = this.run(runId)
    if (run.sessionId && run.sessionId !== sessionId) {
      throw new Error('This Trello run already belongs to another chat.')
    }
    this.store.update((state) => {
      state.runs[runId] = { ...run, sessionId, tabId, agent }
    })
    return this.run(runId)
  }

  private async runWorkflow(run: TrelloRun): Promise<TrelloWorkflow> {
    const board = await this.read.board(run.boardId)
    if (!Object.values(run.workflow).every((id) => board.lists.some((list) => list.id === id))) {
      throw new Error(
        'A list for this Trello run was removed. Configure the board and start a new run.'
      )
    }
    return run.workflow
  }

  start(runId: string) {
    return this.serialize(async () => {
      const run = this.run(runId)
      if (run.phase !== 'prepared') {
        return run
      }
      const workflow = await this.runWorkflow(run)
      const card = await this.read.card(run.cardId)
      if (card.boardId !== run.boardId || card.complete || card.listId === workflow.done) {
        throw new Error(
          'This card was completed or moved to another board. Refresh before starting.'
        )
      }
      await this.read.call('trelloWriteCard', {
        action: 'move',
        cardId: card.id,
        listId: workflow.implementation
      })
      this.store.update((state) => {
        state.runs[runId].phase = 'running'
      })
      return this.run(runId)
    })
  }

  progress(input: TrelloProgress, review = false) {
    return this.serialize(() =>
      this.store
        .mutate(input.requestId, { ...input, review }, async (checkpoint) => {
          const run = this.run(input.runId)
          if (run.phase === 'accepted') {
            throw new Error('The user has already accepted this Trello run.')
          }
          const card = await this.read.card(run.cardId)
          const workflow = await this.runWorkflow(run)
          if (card.boardId !== run.boardId || card.complete || card.listId === workflow.done) {
            throw new Error('This card was completed or moved. Refresh before updating it.')
          }
          for (const check of input.checks ?? []) {
            const list = card.checklists.find((list) => list.id === check.checklistId)
            if (!list?.checkItems.some((item) => item.id === check.itemId)) {
              throw new Error(
                'A checklist item no longer belongs to this card. Refresh before updating.'
              )
            }
          }
          const text = `## Orca · ${review ? 'Test & Abnahme' : 'Arbeitsstand'}\n${input.summary}\n\n### Nachweise und offene Abnahme\n${input.evidence}\n\n<!-- orca-trello:${run.id}:${input.requestId} -->`
          if (text.length > 16000) {
            throw new Error('Keep this progress note shorter.')
          }
          checkpoint({ cardId: card.id, runId: run.id })
          await this.read.call('trelloWriteCard', { action: 'add_comment', cardId: card.id, text })
          for (const check of input.checks ?? []) {
            await this.read.call('trelloWriteChecklist', { action: 'update_item', ...check })
          }
          if (review) {
            await this.read.call('trelloWriteCard', {
              action: 'move',
              cardId: card.id,
              listId: workflow.review
            })
            this.store.update((state) => {
              state.runs[run.id].phase = 'review'
            })
          }
          return { cardId: card.id }
        })
        .then(({ cardId }) => this.read.card(cardId))
    )
  }

  accept(runId: string) {
    return this.serialize(async () => {
      const run = this.run(runId)
      if (run.phase === 'accepted') {
        return run
      }
      if (run.phase !== 'review') {
        throw new Error('The task must reach Test/Acceptance before final acceptance.')
      }
      const workflow = await this.runWorkflow(run)
      const card = await this.read.card(run.cardId)
      if (card.boardId !== run.boardId) {
        throw new Error('The card moved to a different Trello board.')
      }
      if (card.listId !== workflow.review && card.listId !== workflow.done) {
        throw new Error(
          'This card was moved out of Test/Acceptance. Refresh and review the current work first.'
        )
      }
      await this.read.call('trelloWriteCard', {
        action: 'move',
        cardId: card.id,
        listId: workflow.done
      })
      this.store.update((state) => {
        state.runs[run.id].phase = 'accepted'
      })
      return this.run(runId)
    })
  }

  check(input: { cardId: string; checklistId: string; itemId: string; checked: boolean }) {
    return this.serialize(async () => {
      const card = await this.read.card(input.cardId)
      if (
        !card.checklists
          .find((list) => list.id === input.checklistId)
          ?.checkItems.some((item) => item.id === input.itemId)
      ) {
        throw new Error('This checklist item does not belong to the selected card.')
      }
      await this.read.call('trelloWriteChecklist', {
        action: 'update_item',
        checklistId: input.checklistId,
        itemId: input.itemId,
        checked: input.checked
      })
      return this.read.card(card.id)
    })
  }

  create(
    input: {
      requestId: string
      boardId: string
      listId: string
      name: string
      description: string
      templateCardId?: string
    },
    allowDone = false
  ) {
    return this.serialize(() =>
      this.store
        .mutate(input.requestId, input, async (checkpoint) => {
          const board = await this.read.board(input.boardId)
          if (!board.lists.some((list) => list.id === input.listId)) {
            throw new Error('Choose a list from the selected board.')
          }
          if (!allowDone) {
            const workflow = await this.workflow(board.id)
            if (input.listId === workflow.done) {
              throw new Error('New cards must pass user acceptance before moving to Done.')
            }
          }
          const template = input.templateCardId ? await this.read.card(input.templateCardId) : null
          checkpoint({ boardId: board.id, stage: 'creating-card' })
          const created = z.object({ id: z.string() }).parse(
            await this.read.call('trelloWriteCard', {
              action: 'create',
              listId: input.listId,
              name: input.name,
              desc: input.description,
              pos: 'bottom'
            })
          )
          checkpoint({ cardId: created.id, stage: 'card-created' })
          const checklists = template?.checklists ?? [
            {
              name: 'Planung · Umsetzung · Testing',
              checkItems: [
                { name: 'Planung: Umfang, Abhängigkeiten und Abnahmekriterien festgelegt' },
                { name: 'Umsetzung: vereinbarten Umfang umgesetzt' },
                { name: 'Testing: betroffene Abläufe geprüft und Nachweise festgehalten' }
              ]
            }
          ]
          for (const [index, list] of checklists.entries()) {
            const checklist = z.object({ id: z.string() }).parse(
              await this.read.call('trelloWriteChecklist', {
                action: 'create',
                cardId: created.id,
                name: list.name,
                pos: index + 1
              })
            )
            for (const [itemIndex, item] of list.checkItems.entries()) {
              await this.read.call('trelloWriteChecklist', {
                action: 'add_item',
                checklistId: checklist.id,
                text: item.name,
                pos: itemIndex + 1
              })
            }
          }
          return { cardId: created.id }
        })
        .then(({ cardId }) => this.read.card(cardId))
    )
  }
}
