import type { CommandHandler } from '../dispatch'
import { serveWindowsMcp } from '../windows-mcp/windows-mcp-server'

export const WINDOWS_MCP_HANDLERS: Record<string, CommandHandler> = {
  'windows-mcp serve': async ({ client }) => serveWindowsMcp(client)
}
