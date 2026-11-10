import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export const App = z
  .string()
  .regex(/^\d+$/, 'Use the PID returned by windows_apps, not a fuzzy app name.')
export const Target = z.object({ app: App, windowId: z.number().int().nonnegative() })
export const Page = z.object({ page: z.string().min(1), worktree: z.string().min(1).optional() })
export const PageAction = Page.extend({ expectUrl: z.string().url() })
export const Session = z.object({ sessionId: z.string().min(1).optional() })
export const TrelloProgress = z.object({
  requestId: z.string().uuid(),
  runId: z.string().uuid(),
  summary: z.string().min(1).max(4000),
  evidence: z.string().min(1).max(8000),
  checks: z
    .array(
      z.object({ checklistId: z.string().min(1), itemId: z.string().min(1), checked: z.boolean() })
    )
    .max(100)
    .optional()
})
export const Action = Target.extend({
  snapshotId: z.string().min(1),
  action: z.enum([
    'click',
    'setValue',
    'typeText',
    'pressKey',
    'hotkey',
    'pasteText',
    'scroll',
    'drag',
    'performSecondaryAction'
  ]),
  elementIndex: z.number().int().nonnegative().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  text: z.string().max(100000).optional(),
  value: z.string().max(100000).optional(),
  key: z.string().optional(),
  keys: z.string().optional(),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  pages: z.number().positive().optional(),
  fromElementIndex: z.number().int().nonnegative().optional(),
  toElementIndex: z.number().int().nonnegative().optional(),
  fromX: z.number().finite().optional(),
  fromY: z.number().finite().optional(),
  toX: z.number().finite().optional(),
  toY: z.number().finite().optional(),
  secondaryAction: z.string().optional(),
  restoreWindow: z.boolean().default(false)
})

export const ORCA_WORKFLOW_INSTRUCTIONS = `Use Orca's native chat and existing tools. For multi-step work, create a work plan with observable acceptance criteria, then maintain it with work_plan_read/update. Act autonomously on routine reversible work. Do not ask the user to make routine implementation decisions. Check actual results after actions; an action receipt is not proof that the intended outcome happened. Record concrete evidence and strategy against criteria. Keep passed checks unless new evidence invalidates them. Change strategy after repeated failures. If one criterion is blocked, continue other independent work before asking the user. When every criterion passes, set the plan phase to review; Orca pauses the native Codex goal for user acceptance. A waiting or review plan is a stop gate: pause the native goal, do not restart it or repeat GUI actions, and state the exact missing input. Only the user can accept completed work. For linked Trello cards use Orca's Trello workflow and existing layout; submit for review, never mark user acceptance. Use browser DOM tools for web content; use Windows accessibility for native apps. Never claim access to another application's private browser session. Read fresh page/window state before acting. Observe effects after errors before retrying; a timeout may have delivered the action.`

export function windowsMcpContent(value: unknown): CallToolResult {
  const browserShot = z
    .object({ data: z.string(), format: z.enum(['png', 'jpeg']) })
    .safeParse(value)
  if (browserShot.success) {
    return {
      content: [
        { type: 'image', data: browserShot.data.data, mimeType: `image/${browserShot.data.format}` }
      ]
    }
  }
  const result: CallToolResult = {
    content: [{ type: 'text', text: JSON.stringify(value ?? null) }]
  }
  if (value && typeof value === 'object' && 'screenshot' in value) {
    const shot = value.screenshot
    if (shot && typeof shot === 'object' && 'data' in shot && typeof shot.data === 'string') {
      result.content = [
        {
          type: 'text',
          text: JSON.stringify({ ...value, screenshot: { ...shot, data: undefined } })
        },
        {
          type: 'image',
          data: shot.data.replace(/^data:image\/\w+;base64,/, ''),
          mimeType: 'image/png'
        }
      ]
    }
  }
  return result
}
