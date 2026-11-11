import { z } from 'zod'

const Text = z.string().trim().min(1).max(8000)
const Id = z.string().trim().min(1).max(160)
export const WorkCriterion = z.object({
  id: Id,
  title: Text,
  status: z.enum(['pending', 'passed', 'failed', 'blocked']).default('pending'),
  evidence: z.string().max(8000).default('')
})
export const WorkStep = z.object({ id: Id, title: Text, done: z.boolean().default(false) })
export const WorkPlan = z.object({
  sessionId: Id,
  objective: Text,
  revision: z.number().int().positive(),
  phase: z.enum(['planning', 'working', 'paused', 'waiting', 'review', 'accepted']),
  criteria: z.array(WorkCriterion).min(1).max(50),
  steps: z.array(WorkStep).min(1).max(50),
  strategy: z.string().max(8000),
  nextAction: z.string().max(8000),
  noProgress: z.number().int().nonnegative(),
  goalControl: z.enum(['not-active', 'paused', 'unsupported', 'unconfirmed']).optional(),
  updatedAt: z.string(),
  history: z.array(z.object({ at: z.string(), message: Text })).max(100)
})
export type WorkPlan = z.infer<typeof WorkPlan>
const Entry = z.object({ id: Id, title: Text })
export const WorkPlanCommand = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('create'),
    objective: Text,
    criteria: z.array(Entry).min(1).max(50),
    steps: z.array(Entry).min(1).max(50)
  }),
  z.object({
    kind: z.literal('report'),
    criterionId: Id,
    stepId: Id.optional(),
    outcome: z.enum(['passed', 'failed', 'blocked']),
    evidence: Text,
    strategy: Text,
    nextAction: Text
  }),
  z.object({
    kind: z.literal('phase'),
    phase: z.enum(['working', 'paused', 'waiting', 'review']),
    reason: Text
  }),
  z.object({ kind: z.literal('rework'), reason: Text }),
  z.object({ kind: z.literal('accept') })
])
export type WorkPlanCommand = z.infer<typeof WorkPlanCommand>
export const WorkPlanReadParams = z.object({ sessionId: Id.optional() })
export const WorkPlanUpdateParams = WorkPlanReadParams.extend({
  expectedRevision: z.number().int().nonnegative(),
  command: WorkPlanCommand
})
export const AgentWorkPlanUpdateParams = WorkPlanUpdateParams.extend({
  command: z.discriminatedUnion('kind', [
    WorkPlanCommand.options[0],
    WorkPlanCommand.options[1],
    WorkPlanCommand.options[2]
  ])
})
export const WorkPlanRunParams = WorkPlanReadParams.extend({
  expectedRevision: z.number().int().positive()
})

export function changeWorkPlan(
  previous: WorkPlan | null,
  sessionId: string,
  command: WorkPlanCommand,
  user: boolean,
  now: string
): WorkPlan {
  if (command.kind === 'create') {
    if (previous && (!user || previous.phase !== 'accepted')) {
      throw new Error('This chat already has a plan. Keep its evidence and use rework.')
    }
    for (const entries of [command.criteria, command.steps]) {
      if (new Set(entries.map((entry) => entry.id)).size !== entries.length) {
        throw new Error('Plan IDs must be unique.')
      }
    }
    return WorkPlan.parse({
      sessionId,
      objective: command.objective,
      revision: (previous?.revision ?? 0) + 1,
      phase: 'planning',
      criteria: command.criteria,
      steps: command.steps,
      strategy: '',
      nextAction: '',
      noProgress: 0,
      updatedAt: now,
      history: [{ at: now, message: 'Plan created' }]
    })
  }
  if (!previous) {
    throw new Error('Create a plan first.')
  }
  if (previous.phase === 'accepted' && command.kind !== 'rework') {
    throw new Error('The user has accepted this plan.')
  }
  const plan = structuredClone(previous)
  let message: string
  switch (command.kind) {
    case 'report': {
      if (plan.phase === 'waiting' || plan.phase === 'review' || plan.phase === 'paused') {
        throw new Error('Waiting for user feedback. Do not repeat actions or restart the goal.')
      }
      const criterion = plan.criteria.find((entry) => entry.id === command.criterionId)
      if (!criterion) {
        throw new Error('Unknown acceptance criterion.')
      }
      const step = command.stepId
        ? plan.steps.find((entry) => entry.id === command.stepId)
        : undefined
      if (command.stepId && !step) {
        throw new Error('Unknown plan step.')
      }
      const progress = criterion.status !== 'passed' && command.outcome === 'passed'
      criterion.status = command.outcome
      criterion.evidence = command.evidence
      if (step) {
        step.done = command.outcome === 'passed'
      }
      plan.noProgress = progress
        ? 0
        : command.outcome === 'blocked'
          ? plan.noProgress
          : plan.noProgress + 1
      plan.strategy = command.strategy
      plan.nextAction = command.nextAction
      const remaining = plan.criteria.filter((entry) => entry.status !== 'passed')
      plan.phase =
        (remaining.length > 0 && remaining.every((entry) => entry.status === 'blocked')) ||
        plan.noProgress >= 3
          ? 'waiting'
          : 'working'
      if (plan.noProgress >= 3) {
        plan.nextAction =
          'Drei Versuche ohne bestätigten Fortschritt. Prüfe die Nachweise und gib eine neue Richtung vor, bevor die KI weiterarbeitet.'
      } else if (plan.noProgress === 2) {
        plan.nextAction =
          `Zwei Versuche ohne bestätigten Fortschritt. Wechsle den Ansatz vor dem nächsten Versuch. ${command.nextAction}`.slice(
            0,
            8000
          )
      }
      message = `${criterion.title}: ${command.outcome}. ${command.evidence}`
      break
    }
    case 'phase':
      if (
        (plan.phase === 'waiting' || plan.phase === 'review' || plan.phase === 'paused') &&
        !user
      ) {
        throw new Error('Only the user can release this review or waiting gate.')
      }
      if (
        command.phase === 'review' &&
        !plan.criteria.every((entry) => entry.status === 'passed')
      ) {
        throw new Error('Verify every criterion with evidence before review.')
      }
      plan.phase = command.phase
      if (command.phase === 'working') {
        plan.goalControl = undefined
      }
      plan.nextAction = command.reason
      message = command.reason
      break
    case 'rework':
      if (!user) {
        throw new Error('Only the user can request rework.')
      }
      plan.phase = 'working'
      plan.goalControl = undefined
      plan.noProgress = 0
      plan.nextAction = command.reason
      message = command.reason
      break
    case 'accept':
      if (!user) {
        throw new Error('Final acceptance belongs to the user.')
      }
      if (plan.phase !== 'review' || !plan.criteria.every((entry) => entry.status === 'passed')) {
        throw new Error('The verified plan must be in review first.')
      }
      plan.phase = 'accepted'
      message = 'Accepted by the user'
      break
  }
  plan.revision++
  plan.updatedAt = now
  plan.history = [...plan.history, { at: now, message: message.slice(0, 8000) }].slice(-100)
  return plan
}
