import type { SecretAtRestProtection } from '../secret-at-rest-protection'

export type TrelloCheckItem = { id: string; name: string; state: string }
export type TrelloChecklist = { id: string; name: string; checkItems: TrelloCheckItem[] }
export type TrelloCardSummary = {
  id: string
  boardId: string
  listId: string
  name: string
  url: string
  complete: boolean
  hasDescription: boolean
  commentCount: number
  commentsHasMore: boolean
  hasChecklists: boolean
  checklistsComplete: boolean
  checklistTotal: number
  checklistDone: number
}
export type TrelloCard = TrelloCardSummary & {
  description: string
  checklists: TrelloChecklist[]
  comments: { id: string; text: string }[]
  commentsHasMore: boolean
}
export type TrelloBoardOption = { id: string; name: string; url: string }
export type TrelloList = { id: string; name: string }
export type TrelloWorkflow = { implementation: string; review: string; done: string }
export type TrelloBoard = TrelloBoardOption & {
  lists: TrelloList[]
  cards: TrelloCardSummary[]
  workflow: TrelloWorkflow | null
}
export type TrelloRun = {
  id: string
  cardId: string
  boardId: string
  worktreeId: string
  createdAt: string
  phase: 'prepared' | 'running' | 'review' | 'accepted'
  workflow: TrelloWorkflow
  sessionId?: string
  tabId?: string
  agent?: string
}
export type TrelloStatus = {
  connected: boolean
  authorizing: boolean
  error?: string
  credentialProtection?: SecretAtRestProtection | null
  selectedBoardId?: string
  runs: TrelloRun[]
}
export type TrelloProgress = {
  requestId: string
  runId: string
  summary: string
  evidence: string
  checks?: { checklistId: string; itemId: string; checked: boolean }[]
}
