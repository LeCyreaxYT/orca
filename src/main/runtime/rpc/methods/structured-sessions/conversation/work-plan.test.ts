import { expect, it } from 'vitest'
import { RpcDispatcher } from '../../../dispatcher'
import type { OrcaRuntimeService } from '../../../../orca-runtime'
import { WORK_PLAN_METHODS } from './work-plan'

it('refuses agent acceptance, rework and autonomous starts at the RPC boundary', async () => {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: refused calls only read runtime identity and never open a chat or store.
  const runtime = { getRuntimeId: () => 'fixture-runtime' } as unknown as OrcaRuntimeService
  const dispatcher = new RpcDispatcher({ runtime, methods: WORK_PLAN_METHODS })
  for (const kind of ['accept', 'rework']) {
    const result = await dispatcher.dispatch({
      id: 'request',
      authToken: 'fixture',
      method: 'workPlan.update',
      params: {
        expectedRevision: 1,
        command: {
          kind,
          ...(kind === 'rework' ? { reason: 'Continue without user feedback' } : {})
        }
      }
    })
    expect(result).toMatchObject({
      ok: false,
      error: { message: 'Final acceptance and releasing review gates belong to the user in Orca.' }
    })
  }
  const start = await dispatcher.dispatch({
    id: 'request',
    authToken: 'fixture',
    method: 'workPlan.run',
    params: { expectedRevision: 1 }
  })
  expect(start).toMatchObject({
    ok: false,
    error: { message: 'Starting a plan is a user action in Orca.' }
  })
})
