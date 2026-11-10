import { randomUUID } from 'node:crypto'
import {
  createStructuredAgentSessionOperationId,
  structuredAgentSessionPayloadFingerprint
} from '../../shared/agent-session/lifecycle/structured-agent-session-mutation'
import {
  structuredAgentSessionMessageSendMutation,
  structuredAgentSessionSendBody
} from '../../shared/agent-session/requests/structured-agent-session-send-mutation'
import type { AgentSessionThreadGoalChange } from '../../shared/agent-session/agent-session-thread-goal-wire'
import type { WorkPlan } from '../../shared/work-plans/work-plan'
import type { StructuredAgentSessionHost } from '../native-chat/agent-session-wire/host/structured-agent-session-host'
import type { StructuredAgentSessionCaller } from '../native-chat/agent-session-wire/host/structured-agent-session-host-types'

function goalParams(sessionId: string, change: AgentSessionThreadGoalChange) {
  return {
    envelope: {
      sessionId,
      clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
      expectedRuntimeFence: 0,
      payloadFingerprint: structuredAgentSessionPayloadFingerprint({
        method: 'agentSession.threadGoal',
        sessionId,
        fields: { change }
      })
    },
    change
  }
}

export async function pauseWorkPlanGoal(
  host: StructuredAgentSessionHost,
  plan: WorkPlan
): Promise<NonNullable<WorkPlan['goalControl']>> {
  if (!host.readStatusSummary(plan.sessionId)?.hostExecutionOwned) {
    return 'not-active'
  }
  try {
    const options = await host.readOptions(plan.sessionId)
    if (!options.threadGoal) {
      return options.reportedThreadGoal?.current?.status === 'active' ? 'unsupported' : 'not-active'
    }
    if (options.threadGoal.current?.status !== 'active') {
      return 'not-active'
    }
    const result = await host.changeThreadGoal(
      { callerKey: `work-plan:${plan.sessionId}` },
      goalParams(plan.sessionId, { kind: 'status', status: 'paused' })
    )
    return result.ok ? 'paused' : 'unconfirmed'
  } catch {
    return 'unconfirmed'
  }
}

export async function startWorkPlanAgent(
  host: StructuredAgentSessionHost,
  plan: WorkPlan,
  caller: StructuredAgentSessionCaller
): Promise<void> {
  const prompt = `Goal summary: ${plan.objective.slice(0, 1500)}\n\nRead the full objective, acceptance criteria and steps using the orca_windows work_plan_read MCP tool. Maintain this chat's existing plan with work_plan_update. Work autonomously within the authorized scope. Preserve passed evidence, change strategy after failures, and pause the goal when the plan waits or reaches review. Do not restart a waiting goal. Final acceptance belongs to the user.\n\nCurrent direction: ${plan.nextAction.slice(0, 1500)}`
  if (host.sessionAgent(plan.sessionId) === 'codex') {
    const result = await host.changeThreadGoal(
      caller,
      goalParams(plan.sessionId, { kind: 'set', objective: prompt })
    )
    if (!result.ok) {
      throw new Error(result.refusal.message)
    }
    return
  }
  const result = await host.send(caller, {
    ...structuredAgentSessionMessageSendMutation({
      sessionId: plan.sessionId,
      clientOperationId: createStructuredAgentSessionOperationId(randomUUID),
      expectedRuntimeFence: 0,
      body: structuredAgentSessionSendBody(prompt, [])
    }),
    userSend: true
  })
  if (!result.ok) {
    throw new Error(result.refusal.message)
  }
}
