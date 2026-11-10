import { GLOBAL_FLAGS, type CommandSpec } from '../args'

export const WINDOWS_MCP_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['windows-mcp', 'serve'],
    summary: 'Expose Orca desktop, browser and native-chat work plans over MCP stdio',
    usage: 'orca windows-mcp serve',
    allowedFlags: [...GLOBAL_FLAGS]
  }
]
