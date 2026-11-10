import { expect, it } from 'vitest'
import { parse } from 'smol-toml'
import {
  nativeWindowsMcpCodexArgs,
  nativeWindowsMcpServer,
  nativeWindowsMcpClaudeOptions
} from './native-windows-mcp-launch'

it('binds both providers to the selected Orca profile and chat without putting the spawn secret in launch arguments', () => {
  const env = {
    ORCA_CLI_COMMAND: 'C:\\Apps\\Orca Sky\\resources\\bin\\orca.exe',
    ORCA_USER_DATA_PATH: 'C:\\Users\\Alec\\AppData\\Roaming\\orca',
    ORCA_AGENT_SESSION_ID: 'chat-a',
    ORCA_AGENT_SESSION_SPAWN_TOKEN: 'private-spawn-token'
  }
  const args = nativeWindowsMcpCodexArgs(env, 'win32')
  const config = parse(args[1])
  expect(config).toMatchObject({
    mcp_servers: {
      orca_windows: {
        command: 'C:\\Apps\\Orca Sky\\resources\\bin\\orca.exe',
        args: ['windows-mcp', 'serve'],
        env: {
          ORCA_AGENT_SESSION_ID: 'chat-a',
          ORCA_USER_DATA_PATH: 'C:\\Users\\Alec\\AppData\\Roaming\\orca'
        }
      }
    }
  })
  expect(JSON.stringify(config)).not.toContain('private-spawn-token')
  const options = nativeWindowsMcpClaudeOptions(
    { mcpServers: { existing: { command: 'existing-user-server' } } },
    env,
    'win32'
  )
  expect(options.mcpServers).toMatchObject({
    existing: { command: 'existing-user-server' },
    orca_windows: { env: { ORCA_AGENT_SESSION_ID: 'chat-a' } }
  })
  expect(nativeWindowsMcpServer(env, 'linux')).toBeNull()
  expect(nativeWindowsMcpServer({ ...env, ORCA_WINDOWS_MCP: '0' }, 'win32')).toBeNull()
})
