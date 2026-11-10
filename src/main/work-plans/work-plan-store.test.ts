import { describe, expect, it } from 'vitest'
import { WorkPlanStore } from './work-plan-store'

function rig() {
  let saved = ''
  const store = new WorkPlanStore(null, (data) => {
    saved = data
  })
  const edit = (command: Parameters<WorkPlanStore['update']>[2], user = false) =>
    store.update('chat-a', store.read('chat-a')?.revision ?? 0, command, user)
  edit({
    kind: 'create',
    objective: 'Verify the real app flow',
    criteria: [
      { id: 'save', title: 'Saved values survive reopening' },
      { id: 'view', title: 'The app shows the new value' }
    ],
    steps: [
      { id: 'implement', title: 'Implement storage' },
      { id: 'inspect', title: 'Inspect the actual window' }
    ]
  })
  return { store, edit, saved: () => saved }
}

describe('native chat plan lifecycle', () => {
  it('continues independent work when only one acceptance criterion needs user input', () => {
    const { store, edit } = rig()
    edit({
      kind: 'report',
      criterionId: 'view',
      outcome: 'blocked',
      evidence: 'The target client is offline.',
      strategy: 'Finish independent storage work first.',
      nextAction: 'Verify the saved values without a client.'
    })
    expect(store.read('chat-a')).toMatchObject({
      phase: 'working',
      noProgress: 0,
      criteria: [{ status: 'pending' }, { status: 'blocked' }]
    })
    edit({
      kind: 'report',
      criterionId: 'save',
      outcome: 'passed',
      evidence: 'Reopened the stored value.',
      strategy: 'Read actual persisted state.',
      nextAction: 'Connect the client for visual acceptance.'
    })
    expect(store.read('chat-a')).toMatchObject({
      phase: 'waiting',
      criteria: [{ status: 'passed' }, { status: 'blocked' }]
    })
  })

  it('retains passed evidence, requires a new strategy and gates repeated failed work', () => {
    const { store, edit } = rig()
    edit({
      kind: 'report',
      criterionId: 'save',
      stepId: 'implement',
      outcome: 'passed',
      evidence: 'Reopened the saved record: value is 42.',
      strategy: 'Inspect the stored record',
      nextAction: 'Inspect the window'
    })
    const failed = {
      kind: 'report' as const,
      criterionId: 'view',
      outcome: 'failed' as const,
      evidence: 'The window still shows the old value.',
      strategy: 'Reload the same window',
      nextAction: 'Find the state owner'
    }
    edit(failed)
    edit(failed)
    expect(store.read('chat-a')?.noProgress).toBe(2)
    edit(failed)
    expect(store.read('chat-a')).toMatchObject({
      phase: 'waiting',
      noProgress: 3,
      criteria: [
        { id: 'save', status: 'passed', evidence: 'Reopened the saved record: value is 42.' },
        { id: 'view', status: 'failed' }
      ]
    })
    expect(() => edit({ kind: 'phase', phase: 'working', reason: 'Try again' })).toThrow(
      'Only the user'
    )
    expect(() => edit({ kind: 'rework', reason: 'Try again' })).toThrow('Only the user')
    edit({ kind: 'rework', reason: 'The app is now connected; continue the window check.' }, true)
    expect(store.read('chat-a')).toMatchObject({
      phase: 'working',
      noProgress: 0,
      steps: [{ done: true }, { done: false }]
    })
  })

  it('keeps AI verification separate from user acceptance across reload', () => {
    const { edit, saved } = rig()
    expect(() => edit({ kind: 'phase', phase: 'review', reason: 'Ready' })).toThrow(
      'Verify every criterion'
    )
    for (const criterionId of ['save', 'view']) {
      edit({
        kind: 'report',
        criterionId,
        outcome: 'passed',
        evidence: 'Observed the expected persisted value in the real app.',
        strategy: 'Read actual state',
        nextAction: 'Prepare review'
      })
    }
    edit({ kind: 'phase', phase: 'review', reason: 'Review the saved values together.' })
    const reloaded = new WorkPlanStore(saved(), () => {})
    expect(() => reloaded.update('chat-a', 4, { kind: 'accept' }, false)).toThrow(
      'Final acceptance belongs'
    )
    expect(reloaded.update('chat-a', 4, { kind: 'accept' }, true)).toMatchObject({
      phase: 'accepted',
      revision: 5
    })
    expect(() =>
      reloaded.update('chat-a', 5, { kind: 'phase', phase: 'working', reason: 'Retry' }, false)
    ).toThrow('accepted')
  })

  it('rejects stale writers and preserves the last durable plan on write failure', () => {
    const { store, saved } = rig()
    store.update('chat-a', 1, { kind: 'phase', phase: 'working', reason: 'Begin' }, false)
    expect(() =>
      store.update('chat-a', 1, { kind: 'phase', phase: 'paused', reason: 'Stale edit' }, true)
    ).toThrow('plan changed')
    const failure = new WorkPlanStore(saved(), () => {
      throw new Error('disk full')
    })
    expect(() =>
      failure.update('chat-a', 2, { kind: 'phase', phase: 'paused', reason: 'Pause' }, true)
    ).toThrow('disk full')
    expect(failure.read('chat-a')).toMatchObject({ phase: 'working', revision: 2 })
  })
})
