import { createPromptDismissalStore } from '../../../../../shared/prompt-dismissal-store'
import { z } from 'zod'

export type NativeChatPromptDismissal = Readonly<{
  content: string
  /** The host wait's start for a status-backed prompt; null for a transcript-only one. */
  startedAt: number | null
  /** Answered: the card is gone. Collapsed: the user folded it to a strip above the composer. */
  state: 'answered' | 'collapsed'
}>

const storageKey = 'orca.native-chat.closed-questions.v1'
const SavedQuestions = z.array(z.tuple([z.string(), z.array(z.string()).max(256)])).max(128)

export const nativeChatPromptDismissals = createPromptDismissalStore<NativeChatPromptDismissal>({
  read: () => {
    try {
      return SavedQuestions.parse(JSON.parse(localStorage.getItem(storageKey) ?? '[]'))
    } catch {
      return []
    }
  },
  write: (entries) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(entries.slice(-128).map(([key, ids]) => [key, ids.slice(-256)]))
      )
    } catch {
      // An unavailable/full profile store must not prevent hiding the question in this view.
    }
  }
})

export function forgetNativeChatPromptDismissalsForTab(tabId: string): void {
  nativeChatPromptDismissals.forgetWhere((paneKey) => paneKey.startsWith(`${tabId}:`))
}
