import { describe, expect, it, vi } from 'vitest'
import { RpcDispatcher } from '../../dispatcher'
import { needsOrchestrationCallerResolution } from '../../orchestration-session-caller'
import type { OrcaRuntimeService } from '../../../orca-runtime'
import { TRELLO_METHODS } from './trello'

const observation = vi.hoisted(() => ({ subscribe: vi.fn() }))
vi.mock('../../../../trello/trello-host', () => ({
  getTrelloHost: () => ({ service: { store: observation } })
}))

describe('Trello acceptance authority', () => {
  it('prevents an agent from accepting work or remapping its workflow', async () => {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: rejected calls only read the fixture runtime identity.
    const runtime = { getRuntimeId: () => 'test-runtime' } as unknown as OrcaRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: TRELLO_METHODS })
    const request = (method: string, params: unknown) => ({
      id: 'request-a',
      authToken: 'test-token',
      method,
      params
    })
    const acceptance = await dispatcher.dispatch(
      request('trello.accept', { runId: '10000000-0000-4000-8000-000000000001' })
    )
    expect(acceptance).toMatchObject({
      ok: false,
      error: { message: 'Final Trello acceptance belongs to the user in the Orca desktop UI.' }
    })
    const configuration = await dispatcher.dispatch(
      request('trello.configure', {
        boardId: 'board-a',
        workflow: { implementation: 'done', review: 'review', done: 'planned' }
      })
    )
    expect(configuration).toMatchObject({
      ok: false,
      error: { message: 'The user configures Trello workflow lists in the Orca desktop UI.' }
    })
  })

  it('admits session evidence for current-chat links without inventing a caller for ordinary shells', () => {
    const request = { id: 'link', authToken: 'token', method: 'trello.link' }
    expect(needsOrchestrationCallerResolution(request)).toBe(false)
    expect(
      needsOrchestrationCallerResolution({
        ...request,
        orchestrationCompatibilityEvidence: {
          agentSessionId: '10000000-0000-4000-8000-000000000001'
        }
      })
    ).toBe(true)
  })

  it('emits persisted changes and releases its observer when the subscription closes', async () => {
    const method = TRELLO_METHODS.find((method) => method.name === 'trello.watch')
    if (!method || !('stream' in method)) {
      throw new Error('Missing Trello subscription')
    }
    const unsubscribe = vi.fn()
    let changed = (): void => {}
    observation.subscribe.mockImplementation((listener: () => void) => {
      changed = listener
      return unsubscribe
    })
    const controller = new AbortController()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the stream only needs the existing subscription registry contract.
    const runtime = {
      registerOwnedSubscriptionCleanup: (_id: string, cleanup: () => void) => ({
        releaseIfCurrent: cleanup
      })
    } as unknown as OrcaRuntimeService
    const emit = vi.fn()
    await method.handler(
      undefined,
      { runtime, signal: controller.signal, connectionId: 'connection', requestId: 'watch' },
      emit
    )
    changed()
    expect(emit.mock.calls.map(([event]) => event)).toEqual([
      { type: 'ready' },
      { type: 'changed' }
    ])
    controller.abort()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
