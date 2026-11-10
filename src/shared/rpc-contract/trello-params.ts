import { z } from 'zod'

const Id = z.string().trim().min(1).max(4096)
export const TrelloBoardParams = z.object({ boardId: Id })
export const TrelloCardParams = z.object({ cardId: Id })
export const TrelloCommentsParams = TrelloCardParams.extend({
  cursor: z.string().max(4096).optional()
})
export const TrelloRunParams = z.object({ runId: z.string().uuid() })
export const TrelloPrepareParams = z.object({ cardId: Id, worktreeId: Id })
export const TrelloLinkParams = z.object({
  cardId: Id,
  worktree: Id.optional(),
  cwd: Id.optional()
})
export const TrelloBindParams = TrelloRunParams.extend({ sessionId: Id, tabId: Id, agent: Id })
export const TrelloConfigureParams = TrelloBoardParams.extend({
  workflow: z.object({ implementation: Id, review: Id, done: Id })
})
export const TrelloProgressParams = TrelloRunParams.extend({
  requestId: z.string().uuid(),
  summary: z.string().trim().min(1).max(12000),
  evidence: z.string().trim().min(1).max(12000),
  checks: z
    .array(z.object({ checklistId: Id, itemId: Id, checked: z.boolean() }))
    .max(100)
    .optional()
})
export const TrelloCreateParams = z.object({
  requestId: z.string().uuid(),
  boardId: Id,
  listId: Id,
  name: z.string().trim().min(1).max(512),
  description: z.string().max(30000),
  templateCardId: Id.optional()
})
export const TrelloOperationParams = z.object({ requestId: z.string().uuid() })
export const TrelloCheckParams = TrelloCardParams.extend({
  checklistId: Id,
  itemId: Id,
  checked: z.boolean()
})
