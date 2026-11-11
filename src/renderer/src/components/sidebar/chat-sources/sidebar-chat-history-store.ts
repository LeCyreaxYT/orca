import { create } from 'zustand'
import type { AiVaultSession } from '../../../../../shared/ai-vault/contracts/ai-vault-types'
import { sidebarHistoryChatId } from '../../../../../shared/sidebar-chat-sources'
import {
  EMPTY_CODEX_PROJECT_STRUCTURE,
  type CodexProjectStructure
} from '../../../../../shared/ai-vault/contracts/codex-project-structure'

export const EMPTY_SIDEBAR_HISTORY: readonly AiVaultSession[] = []

export const useSidebarChatHistory = create<{
  sessions: readonly AiVaultSession[]
  sessionsById: ReadonlyMap<string, AiVaultSession>
  structure: CodexProjectStructure
  loading: boolean
  error: string | null
}>(() => ({
  sessions: EMPTY_SIDEBAR_HISTORY,
  sessionsById: new Map(),
  structure: EMPTY_CODEX_PROJECT_STRUCTURE,
  loading: false,
  error: null
}))

export function publishSidebarChatHistory(
  sessions: readonly AiVaultSession[],
  structure?: CodexProjectStructure
) {
  const sessionsById = new Map<string, AiVaultSession>()
  for (const session of sessions) {
    const id = sidebarHistoryChatId(session)
    const previous = sessionsById.get(id)
    const updatedAt = Date.parse(session.updatedAt ?? session.modifiedAt)
    const previousUpdatedAt = previous
      ? Date.parse(previous.updatedAt ?? previous.modifiedAt)
      : Number.NaN
    if (
      !previous ||
      (Number.isFinite(updatedAt) &&
        (!Number.isFinite(previousUpdatedAt) || updatedAt > previousUpdatedAt))
    ) {
      sessionsById.set(id, session)
    }
  }
  useSidebarChatHistory.setState({
    sessions: [...sessionsById.values()],
    sessionsById,
    ...(structure ? { structure } : {}),
    error: null
  })
}
