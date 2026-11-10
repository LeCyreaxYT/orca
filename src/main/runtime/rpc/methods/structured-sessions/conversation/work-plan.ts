import { defineMethod, defineStreamingMethod, type RpcContext } from '../../../core'
import {
  WorkPlanReadParams,
  WorkPlanUpdateParams,
  WorkPlanRunParams
} from '../../../../../../shared/work-plans/work-plan'
import { getWorkPlanStore } from '../../../../../work-plans/work-plan-store'
import { isNativeLocalLocation } from '../../../../../../shared/execution-host'
import { bindStructuredAgentSessionStream } from '../subscriptions/structured-agent-session-status-stream'
import {
  requireInstalledStructuredHost,
  structuredCallerFor
} from '../creation/structured-agent-session-gate'
import { getStructuredAgentSessionHost } from '../../../../../native-chat/agent-session-wire/host/structured-agent-session-registry'
import {
  pauseWorkPlanGoal,
  startWorkPlanAgent
} from '../../../../../work-plans/work-plan-agent-control'

function planSession(context: RpcContext, explicit?: string): string {
  const caller = context.orchestrationCaller
  if (caller && explicit && caller.sessionId !== explicit) {
    throw new Error('An agent can only change its own chat plan.')
  }
  const sessionId = caller?.sessionId ?? explicit
  if (!caller && context.caller?.kind !== 'desktop' && context.caller?.kind !== 'paired-device') {
    throw new Error('Use a native Orca chat or the Orca plan panel.')
  }
  const record = sessionId
    ? context.runtime.openedAgentSessionRecordStore()?.getRecord(sessionId)
    : null
  if (!sessionId || !record) {
    throw new Error('The native Orca chat is no longer available.')
  }
  if (!isNativeLocalLocation(record.location)) {
    throw new Error('Open the plan on the host that owns this chat.')
  }
  return sessionId
}

export const WORK_PLAN_METHODS = [
  defineMethod({
    name: 'workPlan.read',
    permission: 'workspace',
    params: WorkPlanReadParams,
    handler: async (params, context) => {
      const sessionId = planSession(context, params.sessionId)
      return (await getWorkPlanStore()).read(sessionId)
    }
  }),
  defineMethod({
    name: 'workPlan.update',
    permission: 'workspace',
    params: WorkPlanUpdateParams,
    handler: async (params, context) => {
      if (
        (params.command.kind === 'accept' || params.command.kind === 'rework') &&
        context.caller?.kind !== 'desktop'
      ) {
        throw new Error('Final acceptance and releasing review gates belong to the user in Orca.')
      }
      const sessionId = planSession(context, params.sessionId)
      const store = await getWorkPlanStore()
      return store.control(sessionId, async () => {
        const plan = store.update(
          sessionId,
          params.expectedRevision,
          params.command,
          context.caller?.kind === 'desktop'
        )
        if (params.command.kind === 'rework') {
          await startWorkPlanAgent(
            await requireInstalledStructuredHost(context, sessionId),
            plan,
            structuredCallerFor(context)
          )
          return plan
        }
        const host = getStructuredAgentSessionHost()
        if (host && ['paused', 'waiting', 'review', 'accepted'].includes(plan.phase)) {
          return (
            store.recordGoalControl(
              sessionId,
              plan.revision,
              await pauseWorkPlanGoal(host, plan)
            ) ?? plan
          )
        }
        return plan
      })
    }
  }),
  defineMethod({
    name: 'workPlan.run',
    permission: 'workspace',
    params: WorkPlanRunParams,
    handler: async (params, context) => {
      if (context.caller?.kind !== 'desktop') {
        throw new Error('Starting a plan is a user action in Orca.')
      }
      const sessionId = planSession(context, params.sessionId)
      const host = await requireInstalledStructuredHost(context, sessionId)
      const store = await getWorkPlanStore()
      return store.control(sessionId, async () => {
        const current = store.read(sessionId)
        if (
          !current ||
          current.phase === 'accepted' ||
          current.phase === 'review' ||
          current.phase === 'waiting'
        ) {
          throw new Error('Release the waiting/review gate with feedback first.')
        }
        const plan = store.update(
          sessionId,
          params.expectedRevision,
          {
            kind: 'phase',
            phase: 'working',
            reason: 'Continue the plan and verify its acceptance criteria.'
          },
          true
        )
        await startWorkPlanAgent(host, plan, structuredCallerFor(context))
        return plan
      })
    }
  }),
  defineStreamingMethod({
    name: 'workPlan.watch',
    permission: 'workspace',
    params: WorkPlanReadParams,
    handler: async (params, context, emit) => {
      const sessionId = planSession(context, params.sessionId)
      const store = await getWorkPlanStore()
      let dispose = (): void => {}
      const stream = bindStructuredAgentSessionStream(
        context,
        `work-plan:${context.connectionId}:${context.requestId}`,
        () => dispose()
      )
      if (stream.isClosed()) {
        return
      }
      dispose = store.subscribe(() => emit(store.read(sessionId)))
      emit(store.read(sessionId))
    }
  })
]
