import { create } from 'zustand'
import type { AiVaultSession } from '../../../../../shared/ai-vault/contracts/ai-vault-types'
import {
  EMPTY_CODEX_PROJECT_STRUCTURE,
  type CodexProjectStructure
} from '../../../../../shared/ai-vault/contracts/codex-project-structure'

export const EMPTY_SIDEBAR_HISTORY: readonly AiVaultSession[] = []

export const useSidebarChatHistory = create<{
  sessions: readonly AiVaultSession[]
  structure: CodexProjectStructure
  loading: boolean
  error: string | null
}>(() => ({
  sessions: EMPTY_SIDEBAR_HISTORY,
  structure: EMPTY_CODEX_PROJECT_STRUCTURE,
  loading: false,
  error: null
}))
