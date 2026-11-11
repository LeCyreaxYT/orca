import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { getAppEnvironment } from '../../shared/app-environment'
import { WorkPlan, changeWorkPlan, type WorkPlanCommand } from '../../shared/work-plans/work-plan'
import { writeCredentialFileAtomic } from '../credentials/integration-credential-file'

const Plans = z.record(z.string(), WorkPlan)
const SavedPlans = z.object({
  schemaVersion: z.literal(1),
  plans: Plans,
  archive: z.array(WorkPlan)
})

export class WorkPlanStore {
  private readonly plans: Record<string, WorkPlan>
  private readonly archive: WorkPlan[]
  private readonly listeners = new Set<() => void>()
  private readonly controls = new Map<string, Promise<unknown>>()

  constructor(
    saved: string | null,
    private readonly write: (data: string) => void
  ) {
    const raw: unknown = saved ? JSON.parse(saved) : {}
    const stored =
      raw && typeof raw === 'object' && 'schemaVersion' in raw
        ? SavedPlans.parse(raw)
        : { plans: Plans.parse(raw), archive: [] }
    this.plans = stored.plans
    this.archive = stored.archive
  }

  read(sessionId: string): WorkPlan | null {
    return this.plans[sessionId] ? structuredClone(this.plans[sessionId]) : null
  }

  control<T>(sessionId: string, run: () => Promise<T>): Promise<T> {
    const previous = this.controls.get(sessionId) ?? Promise.resolve()
    const current = previous.catch(() => {}).then(run)
    this.controls.set(sessionId, current)
    void current
      .finally(() => {
        if (this.controls.get(sessionId) === current) {
          this.controls.delete(sessionId)
        }
      })
      .catch(() => {})
    return current
  }

  update(sessionId: string, revision: number, command: WorkPlanCommand, user: boolean): WorkPlan {
    const previous = this.read(sessionId)
    if ((previous?.revision ?? 0) !== revision) {
      throw new Error('The plan changed. Read it again before editing.')
    }
    return this.commit(
      changeWorkPlan(previous, sessionId, command, user, new Date().toISOString()),
      command.kind === 'create' ? previous : null
    )
  }

  private commit(next: WorkPlan, archived: WorkPlan | null = null): WorkPlan {
    const sessionId = next.sessionId
    const archive = archived ? [...this.archive, archived] : this.archive
    this.write(
      JSON.stringify({ schemaVersion: 1, plans: { ...this.plans, [sessionId]: next }, archive })
    )
    this.plans[sessionId] = next
    if (archived) {
      this.archive.push(archived)
    }
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        /* A disconnected observer cannot undo a saved plan. */
      }
    }
    return structuredClone(next)
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  recordGoalControl(
    sessionId: string,
    revision: number,
    goalControl: WorkPlan['goalControl']
  ): WorkPlan | null {
    const current = this.read(sessionId)
    if (!current || current.revision !== revision) {
      return current
    }
    return this.commit({ ...current, goalControl, revision: revision + 1 })
  }
}

const stores = new Map<string, Promise<WorkPlanStore>>()
export function getWorkPlanStore(): Promise<WorkPlanStore> {
  const app = getAppEnvironment()
  const root = app.getPath('userData')
  let store = stores.get(root)
  if (!store) {
    store = (async () => {
      const directory = join(root, 'work-plans')
      await mkdir(directory, { recursive: true, mode: 0o700 })
      const path = join(directory, 'plans.json')
      const saved = await readFile(path, 'utf8').catch((error: unknown) => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return null
        }
        throw error
      })
      app.onWillQuit(() => {
        stores.delete(root)
      })
      return new WorkPlanStore(saved, (data) => writeCredentialFileAtomic(path, Buffer.from(data)))
    })().catch((error: unknown) => {
      stores.delete(root)
      throw error
    })
    stores.set(root, store)
  }
  return store
}
