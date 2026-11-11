import { useCallback, useEffect, useState } from 'react'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { subscribeRuntimeRpc } from '@/runtime/rpc/subscriptions/runtime-rpc-subscribe'
import { WorkPlan, type WorkPlanCommand } from '../../../../shared/work-plans/work-plan'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

function failureMessage(error: unknown): string {
  return error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : String(error)
}

export function useWorkPlan(sessionId: string, target: RuntimeClientTarget, open: boolean) {
  const [plan, setPlan] = useState<WorkPlan | null>(null)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!open) {
      return
    }
    let alive = true
    let release = (): void => {}
    setReady(false)
    setPlan(null)
    setError(null)
    const fail = (cause: unknown) => {
      if (!alive) {
        return
      }
      setReady(false)
      setError(failureMessage(cause))
    }
    void subscribeRuntimeRpc(
      target,
      'workPlan.watch',
      { sessionId },
      {
        onEvent: (value) => {
          if (!alive) {
            return
          }
          const result = WorkPlan.nullable().safeParse(value)
          if (!result.success) {
            fail(
              new Error('The host returned an unreadable plan. Update this Orca host and retry.')
            )
            return
          }
          setPlan(result.data)
          setReady(true)
        },
        onError: fail,
        onClose: () => fail(new Error('Connection closed. Reconnect to load the current plan.'))
      }
    )
      .then((subscription) => {
        if (alive) {
          release = subscription.unsubscribe
        } else {
          subscription.unsubscribe()
        }
      })
      .catch(fail)
    return () => {
      alive = false
      release()
    }
  }, [sessionId, target, open, retry])

  const update = useCallback(
    async (command: WorkPlanCommand | 'run') => {
      if (pending || !ready) {
        return
      }
      setPending(true)
      setError(null)
      try {
        const value = await callRuntimeRpc<WorkPlan>(
          target,
          command === 'run' ? 'workPlan.run' : 'workPlan.update',
          {
            sessionId,
            expectedRevision: plan?.revision ?? 0,
            ...(command === 'run' ? {} : { command })
          }
        )
        setPlan(value)
        return true
      } catch (cause) {
        setError(failureMessage(cause))
        return false
      } finally {
        setPending(false)
      }
    },
    [pending, ready, target, sessionId, plan]
  )
  return { plan, ready, pending, error, update, retry: () => setRetry((value) => value + 1) }
}
