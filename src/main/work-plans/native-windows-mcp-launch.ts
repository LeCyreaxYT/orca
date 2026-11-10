import type { Options } from '@anthropic-ai/claude-agent-sdk'

export function nativeWindowsMcpServer(
  env: Record<string, string>,
  platform = process.platform
): { command: string; args: string[]; env: Record<string, string> } | null {
  if (platform !== 'win32' || !env.ORCA_CLI_COMMAND || env.ORCA_WINDOWS_MCP === '0') {
    return null
  }
  const names = ['ORCA_USER_DATA_PATH', 'ORCA_AGENT_SESSION_ID']
  return {
    command: env.ORCA_CLI_COMMAND,
    args: ['windows-mcp', 'serve'],
    env: Object.fromEntries(names.filter((name) => env[name]).map((name) => [name, env[name]]))
  }
}

export function nativeWindowsMcpClaudeOptions<T extends { mcpServers?: Options['mcpServers'] }>(
  options: T,
  env: Record<string, string>,
  platform = process.platform
): T {
  const server = nativeWindowsMcpServer(env, platform)
  return server
    ? { ...options, mcpServers: { ...options.mcpServers, orca_windows: server } }
    : options
}

export function nativeWindowsMcpCodexArgs(
  env: Record<string, string>,
  platform = process.platform
): string[] {
  const server = nativeWindowsMcpServer(env, platform)
  if (!server) {
    return []
  }
  const fields = [
    `command = ${JSON.stringify(server.command)}`,
    'args = ["windows-mcp", "serve"]',
    'startup_timeout_sec = 30'
  ]
  if (Object.keys(server.env).length) {
    fields.push(
      `env = { ${Object.entries(server.env)
        .map(([key, value]) => `${JSON.stringify(key)} = ${JSON.stringify(value)}`)
        .join(', ')} }`
    )
  }
  return ['-c', `mcp_servers.orca_windows={${fields.join(', ')}}`]
}
