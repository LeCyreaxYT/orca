import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { WorkPlan, AgentWorkPlanUpdateParams } from '../../shared/work-plans/work-plan'
import { RuntimeClientError } from '../runtime/types'
import {
  App,
  Target,
  Page,
  PageAction,
  Session,
  TrelloProgress,
  Action,
  ORCA_WORKFLOW_INSTRUCTIONS,
  windowsMcpContent
} from './windows-mcp-contract'

export type OrcaMcpRuntime = {
  call: (method: string, params?: unknown) => Promise<{ result: unknown }>
}

export function createWindowsMcpServer(client: OrcaMcpRuntime): McpServer {
  const server = new McpServer(
    { name: 'orca-windows', version: '1.0.0' },
    { instructions: ORCA_WORKFLOW_INSTRUCTIONS }
  )
  const snapshots = new Map<string, string>()
  const session = `mcp:${process.pid}`
  const register = <T extends z.ZodRawShape>(
    name: string,
    description: string,
    schema: z.ZodObject<T>,
    readOnly: boolean,
    run: (params: z.output<z.ZodObject<T>>) => Promise<unknown>
  ) => {
    server.registerTool<z.ZodRawShape, z.ZodObject<T>>(
      name,
      {
        description,
        inputSchema: schema,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          idempotentHint: readOnly,
          openWorldHint: true
        }
      },
      async (params: unknown): Promise<CallToolResult> => {
        try {
          if (
            !readOnly &&
            (name.startsWith('windows_') || name.startsWith('browser_')) &&
            process.env.ORCA_AGENT_SESSION_ID
          ) {
            const state = WorkPlan.nullable().parse((await client.call('workPlan.read', {})).result)
            if (state && ['waiting', 'review', 'accepted', 'paused'].includes(state.phase)) {
              throw new Error(
                'The work plan is paused or waiting for the user. Do not repeat browser/desktop actions.'
              )
            }
          }
          return windowsMcpContent(await run(schema.parse(params)))
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text:
                  error instanceof RuntimeClientError && error.data !== undefined
                    ? JSON.stringify({ message: error.message, recovery: error.data })
                    : error instanceof Error
                      ? error.message
                      : String(error)
              }
            ]
          }
        }
      }
    )
  }
  const call = async (method: string, params: unknown) => (await client.call(method, params)).result
  register(
    'windows_capabilities',
    'Check the actual desktop provider and supported operations.',
    z.object({}),
    true,
    () => call('computer.capabilities', {})
  )
  register(
    'windows_apps',
    'List running applications with PIDs. Does not focus or activate windows.',
    z.object({}),
    true,
    () => call('computer.listApps', {})
  )
  register(
    'windows_windows',
    'List windows belonging to an exact PID.',
    z.object({ app: App }),
    true,
    (params) => call('computer.listWindows', params)
  )
  register(
    'windows_observe',
    'Read a pinned window accessibility tree and screenshot without restoring or focusing it.',
    Target.extend({ noScreenshot: z.boolean().default(false) }),
    true,
    async (params) => {
      const result = await call('computer.getAppState', {
        ...params,
        session,
        restoreWindow: false
      })
      const parsed = z.object({ snapshot: z.object({ id: z.string() }) }).parse(result)
      snapshots.set(`${params.app}:${params.windowId}`, parsed.snapshot.id)
      return result
    }
  )
  register(
    'windows_action',
    'Act only on the latest observed window. Some input needs foreground access. Inspect verification and observe again. Never retry blindly.',
    Action,
    false,
    async ({ snapshotId, action, secondaryAction, ...params }) => {
      const key = `${params.app}:${params.windowId}`
      if (snapshots.get(key) !== snapshotId) {
        throw new Error(
          'Stale or missing observation. Call windows_observe on this exact PID/window first.'
        )
      }
      snapshots.delete(key)
      return call(`computer.${action}`, {
        ...params,
        session,
        ...(secondaryAction ? { action: secondaryAction } : {})
      })
    }
  )
  register(
    'browser_pages',
    'List pages in Orca’s own browser. Does not access ChatGPT’s private in-app browser.',
    z.object({ worktree: z.string().min(1).optional() }),
    true,
    (params) => call('browser.tabList', params)
  )
  register(
    'browser_open',
    'Open an Orca browser page in an explicitly named workspace without selecting or focusing it.',
    z.object({ worktree: z.string().min(1), url: z.string().url() }),
    false,
    (params) => call('browser.tabCreate', { ...params, activate: false, waitForRegistration: true })
  )
  register(
    'browser_observe',
    'Read a fresh DOM snapshot with element references from an exact Orca page.',
    Page,
    true,
    (params) =>
      call('browser.snapshot', { ...params, interactive: true, compact: true, urls: true })
  )
  register(
    'browser_screenshot',
    'Capture an Orca page for visual verification after inspecting its DOM.',
    Page,
    true,
    (params) => call('browser.screenshot', { ...params, format: 'png' })
  )
  register(
    'browser_navigate',
    'Navigate an existing Orca page, verifying its current URL first.',
    PageAction.extend({ url: z.string().url() }),
    false,
    (params) => call('browser.goto', params)
  )
  register(
    'browser_click',
    'Click an element from a fresh DOM snapshot, with a current-URL guard.',
    PageAction.extend({ element: z.string().min(1) }),
    false,
    (params) => call('browser.click', params)
  )
  register(
    'browser_fill',
    'Fill a field from a fresh DOM snapshot, with a current-URL guard.',
    PageAction.extend({ element: z.string().min(1), value: z.string() }),
    false,
    (params) => call('browser.fill', params)
  )
  register(
    'work_plan_read',
    'Read this native chat’s persistent plan, evidence and stop gates before continuing.',
    Session,
    true,
    (params) => call('workPlan.read', params)
  )
  register(
    'work_plan_update',
    'Create a plan or report verified progress using expectedRevision (0 to create). Re-read conflicts. Final acceptance and releasing waiting/review gates belong to the user.',
    AgentWorkPlanUpdateParams,
    false,
    (params) => {
      return call('workPlan.update', params)
    }
  )
  register(
    'trello_status',
    'Read existing Trello bindings and workflow runs. Use the run bound to this native chat.',
    z.object({}),
    true,
    () => call('trello.status', {})
  )
  register(
    'trello_link',
    'Link a user-selected Trello card to this native chat, using the existing board workflow.',
    z.object({ cardId: z.string().min(1), worktree: z.string().optional() }),
    false,
    (params) => call('trello.link', params)
  )
  register(
    'trello_card',
    'Read the original card layout and real checklist/item IDs before updating checks.',
    z.object({ cardId: z.string().min(1) }),
    true,
    (params) => call('trello.card', params)
  )
  register(
    'trello_start',
    'Begin this chat’s linked Trello run using the board’s configured implementation list.',
    z.object({ runId: z.string().uuid() }),
    false,
    (params) => call('trello.start', params)
  )
  register(
    'trello_operation',
    'Inspect the receipt of an uncertain Trello write before deciding whether to retry. Keep its original requestId.',
    z.object({ requestId: z.string().uuid() }),
    true,
    (params) => call('trello.operation', params)
  )
  register(
    'trello_progress',
    'Record concrete evidence and named checkboxes using a durable requestId. Inspect uncertain operations before retrying.',
    TrelloProgress,
    false,
    (params) => call('trello.progress', params)
  )
  register(
    'trello_review',
    'Submit verified results for the user to review. This never grants final acceptance or moves the card to Done.',
    TrelloProgress,
    false,
    (params) => call('trello.review', params)
  )
  return server
}

export async function serveWindowsMcp(client: OrcaMcpRuntime): Promise<void> {
  await createWindowsMcpServer(client).connect(new StdioServerTransport())
}
