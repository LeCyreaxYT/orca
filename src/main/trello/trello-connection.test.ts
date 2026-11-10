import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrelloAuthorization } from './trello-authorization-store'

const vault = vi.hoisted(() => ({ serialized: '{}' }))
vi.mock('./trello-authorization-store', () => ({
  createTrelloAuthorizationStore: () => ({
    read: () => JSON.parse(vault.serialized),
    save: (value: TrelloAuthorization) => {
      vault.serialized = JSON.stringify(value)
    },
    status: () => ({
      connected: Boolean(JSON.parse(vault.serialized).tokens),
      credentialProtection: 'sealed'
    })
  })
}))
import { TrelloConnection } from './trello-connection'

const nativeFetch = globalThis.fetch
beforeEach(() => {
  vault.serialized = '{}'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

function fakeCloud(options: { beforeToken?: () => Promise<void> } = {}) {
  const json = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.hostname === '127.0.0.1') {
      return nativeFetch(input, init)
    }
    if (url.pathname.includes('oauth-protected-resource')) {
      return json({
        resource: 'https://mcp.trello.com/v1',
        authorization_servers: ['https://auth.atlassian.com'],
        scopes_supported: [
          'offline_access',
          'read:me',
          'read:account',
          'read:board:trello',
          'write:board:trello',
          'read:organization:trello',
          'write:organization:trello',
          'read:member:trello',
          'read:member.inbox:trello',
          'write:member.inbox:trello',
          'read:member.planner:trello',
          'write:member.planner:trello'
        ]
      })
    }
    if (url.pathname.includes('oauth-authorization-server')) {
      return json({
        issuer: 'https://auth.atlassian.com',
        authorization_endpoint: 'https://auth.atlassian.com/authorize',
        token_endpoint: 'https://auth.atlassian.com/token',
        registration_endpoint: 'https://auth.atlassian.com/register',
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        token_endpoint_auth_methods_supported: ['none'],
        code_challenge_methods_supported: ['S256']
      })
    }
    if (url.pathname === '/register') {
      return json({ ...JSON.parse(String(init?.body)), client_id: 'test-client' }, 201)
    }
    if (url.pathname === '/token') {
      await options.beforeToken?.()
      return json({
        access_token: 'authorized-token',
        token_type: 'Bearer',
        refresh_token: 'refresh-token',
        expires_in: 3600
      })
    }
    if (url.hostname !== 'mcp.trello.com') {
      throw new Error(`Unexpected OAuth request to ${url.hostname}`)
    }
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    )
    if (headers.get('authorization') !== 'Bearer authorized-token') {
      return new Response('', {
        status: 401,
        headers: {
          'WWW-Authenticate':
            'Bearer resource_metadata="https://mcp.trello.com/.well-known/oauth-protected-resource/v1"'
        }
      })
    }
    if ((init?.method ?? 'GET') === 'GET') {
      return new Response('', { status: 405 })
    }
    const body = JSON.parse(String(init?.body))
    if (body.method === 'initialize') {
      return json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: body.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: 'test-trello', version: '1' }
        }
      })
    }
    if (body.method === 'notifications/initialized') {
      return new Response(null, { status: 202 })
    }
    if (body.method === 'tools/call') {
      return json({
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: '{"boards":[]}' }] }
      })
    }
    throw new Error('Unexpected MCP method')
  })
}

describe('Orca Trello OAuth lifecycle', () => {
  it('finishes browser authorization and can load Trello through the saved connection', async () => {
    fakeCloud()
    const connection = new TrelloConnection('memory-only')
    try {
      const { authorizationUrl } = await connection.beginAuthorization()
      const authorization = new URL(authorizationUrl)
      expect(authorization.searchParams.get('scope')).toBe(
        'offline_access read:me read:account read:board:trello write:board:trello read:organization:trello write:organization:trello read:member:trello read:member.inbox:trello write:member.inbox:trello read:member.planner:trello write:member.planner:trello'
      )
      const callback = new URL(authorization.searchParams.get('redirect_uri')!)
      callback.searchParams.set('state', authorization.searchParams.get('state')!)
      callback.searchParams.set('code', 'accepted-code')
      expect(connection.status().authorizing).toBe(true)
      const response = await nativeFetch(callback)
      expect(response.status).toBe(200)
      expect(connection.status()).toMatchObject({ connected: true, authorizing: false })
      expect(await connection.call('trelloReadBoard', { action: 'list' })).toEqual({ boards: [] })
    } finally {
      await connection.dispose()
    }
  })

  it('does not restore access when token refresh finishes after the user disconnects', async () => {
    vault.serialized = JSON.stringify({
      redirectUrl: 'http://127.0.0.1:5000/callback',
      client: { client_id: 'test-client', issuer: 'https://auth.atlassian.com' },
      tokens: {
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        issuer: 'https://auth.atlassian.com'
      }
    })
    let tokenStarted!: () => void
    let finishToken!: () => void
    const started = new Promise<void>((resolve) => {
      tokenStarted = resolve
    })
    const tokenGate = new Promise<void>((resolve) => {
      finishToken = resolve
    })
    fakeCloud({
      beforeToken: async () => {
        tokenStarted()
        await tokenGate
      }
    })
    const connection = new TrelloConnection('memory-only')
    const read = connection.call('trelloReadBoard', { action: 'list' })
    const failure = expect(read).rejects.toThrow('Trello is unavailable')
    try {
      await started
      await connection.disconnect()
      finishToken()
      await failure
      expect(connection.status()).toMatchObject({ connected: false, authorizing: false })
      expect(JSON.parse(vault.serialized)).toEqual({})
    } finally {
      finishToken()
      await connection.dispose()
    }
  })
})
