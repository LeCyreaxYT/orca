import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { writeCredentialFileAtomic } from '../credentials/integration-credential-file'
import type { TrelloRun, TrelloWorkflow } from '../../shared/trello/trello-types'

export type TrelloOperation = {
  hash: string
  state: 'preparing' | 'pending' | 'confirmed' | 'unknown' | 'rejected'
  result?: unknown
}
type TrelloState = {
  selectedBoardId?: string
  workflows: Record<string, TrelloWorkflow>
  runs: Record<string, TrelloRun>
  operations: Record<string, TrelloOperation>
}

export type TrelloStateStorage = { read: () => string | null; write: (value: string) => void }
const Workflow = z.object({ implementation: z.string(), review: z.string(), done: z.string() })
const State = z.object({
  selectedBoardId: z.string().optional(),
  workflows: z.record(z.string(), Workflow),
  runs: z.record(
    z.string(),
    z.object({
      id: z.string().uuid(),
      cardId: z.string(),
      boardId: z.string(),
      worktreeId: z.string(),
      createdAt: z.string(),
      phase: z.enum(['prepared', 'running', 'review', 'accepted']),
      workflow: Workflow,
      sessionId: z.string().optional(),
      tabId: z.string().optional(),
      agent: z.string().optional()
    })
  ),
  operations: z.record(
    z.string(),
    z.object({
      hash: z.string(),
      state: z.enum(['preparing', 'pending', 'confirmed', 'unknown', 'rejected']),
      result: z.unknown().optional()
    })
  )
})

export class TrelloStore {
  readonly directory: string
  private readonly storage: TrelloStateStorage
  private readonly state: TrelloState
  private readonly listeners = new Set<() => void>()

  static async open(root: string): Promise<TrelloStore> {
    const directory = join(root, 'trello')
    await mkdir(directory, { recursive: true, mode: 0o700 })
    const path = join(directory, 'workflow.json')
    let saved = await readFile(path, 'utf8').catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null
      }
      throw error
    })
    return new TrelloStore(root, {
      read: () => saved,
      write: (value) => {
        writeCredentialFileAtomic(path, Buffer.from(value))
        saved = value
      }
    })
  }

  constructor(root: string, storage: TrelloStateStorage) {
    this.directory = join(root, 'trello')
    this.storage = storage
    const saved = this.storage.read()
    this.state = saved
      ? State.parse(JSON.parse(saved))
      : { workflows: {}, runs: {}, operations: {} }
  }

  read(): TrelloState {
    return structuredClone(this.state)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  update(edit: (state: TrelloState) => void, options?: { notify: boolean }): void {
    const next = structuredClone(this.state)
    edit(next)
    this.storage.write(JSON.stringify(next))
    Object.assign(this.state, next)
    if (options?.notify === false) {
      return
    }
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        /* A closed observer must not fail a persisted write. */
      }
    }
  }

  async mutate(
    requestId: string,
    input: unknown,
    action: (checkpoint: (result: unknown) => void) => Promise<{ cardId: string }>
  ): Promise<{ cardId: string }> {
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
    const prior = this.state.operations[requestId]
    if (prior) {
      if (prior.hash !== hash) {
        throw new Error('Trello request id already belongs to another operation.')
      }
      if (prior.state === 'confirmed') {
        return z.object({ cardId: z.string().min(1) }).parse(prior.result)
      }
      if (prior.state === 'pending' || prior.state === 'unknown') {
        throw new Error(
          `Trello result is unconfirmed. Inspect orca trello operation --request ${requestId} before taking another action.`
        )
      }
    }
    this.update(
      (state) => {
        state.operations[requestId] = { hash, state: 'preparing' }
      },
      { notify: false }
    )
    let dispatched = false
    try {
      const result = await action((result) => {
        this.update(
          (state) => {
            state.operations[requestId] = { hash, state: 'pending', result }
          },
          { notify: false }
        )
        dispatched = true
      })
      this.update((state) => {
        state.operations[requestId] = { hash, state: 'confirmed', result }
      })
      return result
    } catch (error) {
      this.update((state) => {
        state.operations[requestId] = {
          ...state.operations[requestId],
          hash,
          state: dispatched ? 'unknown' : 'rejected'
        }
      })
      throw error
    }
  }
}
