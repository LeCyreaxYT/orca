import { expect, it } from 'vitest'
import {
  createPromptDismissalStore,
  type AsyncPromptDismissalStorage
} from './prompt-dismissal-store'

it('restores closed occurrences after a renderer restart without hiding other conversations or later questions', () => {
  let saved: readonly [string, readonly string[]][] = []
  const storage: AsyncPromptDismissalStorage = {
    read: () => saved,
    write: (entries) => {
      saved = entries
    }
  }
  createPromptDismissalStore(storage).hideAsync('host-a/session', ['question-one'])
  const reopened = createPromptDismissalStore(storage)
  expect([...reopened.readAsync('host-a/session')]).toEqual(['question-one'])
  expect(reopened.readAsync('host-a/session').has('question-two')).toBe(false)
  expect([...reopened.readAsync('host-b/session')]).toEqual([])
})
