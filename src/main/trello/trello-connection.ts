import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { auth, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import {
  createTrelloAuthorizationStore,
  type TrelloAuthorization
} from './trello-authorization-store'
import {
  createTrelloOAuthProvider,
  TRELLO_AUTH_OPTIONS,
  TRELLO_MCP_URL
} from './trello-oauth-provider'
type PendingAuthorization = {
  server: Server
  timeout: NodeJS.Timeout
  provider: OAuthClientProvider
  authorizationUrl?: string
  exchanging?: boolean
}

export class TrelloConnection {
  private readonly authorization: ReturnType<typeof createTrelloAuthorizationStore>
  private client: Client | null = null
  private connecting: Promise<Client> | null = null
  private pending: PendingAuthorization | null = null
  private error: string | undefined
  private generation = 0
  private starting: Promise<{ authorizationUrl: string }> | null = null

  constructor(directory: string) {
    this.authorization = createTrelloAuthorizationStore(directory)
  }

  status() {
    const stored = this.authorization.status()
    const authorizing = Boolean(this.pending || this.starting)
    return {
      ...stored,
      connected: stored.connected && !authorizing,
      authorizing,
      error: this.error
    }
  }

  private provider(
    saved: TrelloAuthorization,
    redirectUrl: string,
    onRedirect?: (url: URL) => void,
    state?: string,
    generation = this.generation
  ): OAuthClientProvider {
    return createTrelloOAuthProvider(
      saved,
      redirectUrl,
      () => {
        if (generation !== this.generation) {
          throw new Error('Trello authorization was cancelled.')
        }
        return this.authorization.save(saved, () => generation === this.generation)
      },
      onRedirect,
      state
    )
  }

  beginAuthorization(): Promise<{ authorizationUrl: string }> {
    if (this.starting) {
      return this.starting
    }
    const start = this.startAuthorization()
    this.starting = start
    void start
      .finally(() => {
        if (this.starting === start) {
          this.starting = null
        }
      })
      .catch(() => {})
    return start
  }

  private async startAuthorization(): Promise<{ authorizationUrl: string }> {
    if (this.pending?.authorizationUrl) {
      return { authorizationUrl: this.pending.authorizationUrl }
    }
    if (this.pending) {
      throw new Error('Trello authorization is already starting.')
    }
    const generation = ++this.generation
    const previousClient = this.client
    this.client = null
    this.connecting = null
    await previousClient?.close().catch(() => {})
    if (generation !== this.generation) {
      throw new Error('Trello authorization was cancelled.')
    }
    this.error = undefined
    const state = randomBytes(32).toString('hex')
    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      response.setHeader('Content-Type', 'text/plain; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Content-Security-Policy', "default-src 'none'")
      if (
        request.method !== 'GET' ||
        url.pathname !== '/callback' ||
        url.searchParams.get('state') !== state
      ) {
        response.writeHead(400).end('Invalid authorization callback.')
        return
      }
      const pending = this.pending
      if (!pending || pending.server !== server) {
        response.writeHead(410).end('Authorization expired. Return to Orca.')
        return
      }
      if (pending.exchanging) {
        response.writeHead(409).end('Authorization is already being completed. Return to Orca.')
        return
      }
      pending.exchanging = true
      try {
        const code = url.searchParams.get('code')
        if (!code || url.searchParams.has('error')) {
          throw new Error('Authorization declined.')
        }
        await auth(pending.provider, { ...TRELLO_AUTH_OPTIONS, authorizationCode: code })
        const connected = await this.connectSaved(generation)
        const old = this.client
        this.client = connected
        await old?.close().catch(() => {})
        response.end('Trello is connected. You can return to Orca Sky.')
      } catch {
        if (generation === this.generation) {
          this.error = 'Trello authorization did not finish. Connect again.'
        }
        response
          .writeHead(400)
          .end('Authorization did not finish. Return to Orca and connect again.')
      } finally {
        clearTimeout(pending.timeout)
        server.close()
        if (this.pending === pending) {
          this.pending = null
        }
      }
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    if (generation !== this.generation) {
      server.close()
      throw new Error('Trello authorization was cancelled.')
    }
    server.unref()
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Could not start Trello authorization.')
    }
    const provider = this.provider(
      {},
      `http://127.0.0.1:${address.port}/callback`,
      (url) => {
        if (this.pending?.server === server) {
          this.pending.authorizationUrl = url.href
        }
      },
      state,
      generation
    )
    const timeout = setTimeout(() => {
      if (this.pending?.server !== server) {
        return
      }
      this.generation++
      this.error = 'Trello authorization expired. Connect again.'
      this.pending = null
      server.close()
    }, 180000)
    timeout.unref()
    this.pending = { server, timeout, provider }
    try {
      await auth(provider, TRELLO_AUTH_OPTIONS)
    } catch {
      if (
        generation !== this.generation ||
        this.pending?.server !== server ||
        !this.pending.authorizationUrl
      ) {
        clearTimeout(timeout)
        server.close()
        if (this.pending?.server === server) {
          this.pending = null
        }
        throw new Error('Could not start Trello authorization. Try connecting again.')
      }
    }
    const authorizationUrl =
      generation === this.generation && this.pending?.server === server
        ? this.pending.authorizationUrl
        : undefined
    if (!authorizationUrl) {
      throw new Error('Trello did not return an authorization page.')
    }
    return { authorizationUrl }
  }

  async disconnect(): Promise<void> {
    await this.dispose()
    await this.authorization.save({})
    this.error = undefined
  }

  async dispose(): Promise<void> {
    this.generation++
    const pending = this.pending
    const client = this.client
    this.pending = null
    this.client = null
    this.connecting = null
    this.starting = null
    if (pending) {
      clearTimeout(pending.timeout)
      pending.server.close()
    }
    await client?.close().catch(() => {})
  }

  private async ready(): Promise<Client> {
    if (this.pending || this.starting) {
      throw new Error('Complete Trello authorization before loading boards.')
    }
    if (this.client) {
      return this.client
    }
    if (this.connecting) {
      return this.connecting
    }
    const generation = this.generation
    const connecting = this.connectSaved(generation)
      .then((client) => {
        this.client = client
        return client
      })
      .finally(() => {
        if (this.connecting === connecting) {
          this.connecting = null
        }
      })
    this.connecting = connecting
    return connecting
  }

  private async connectSaved(generation: number): Promise<Client> {
    const saved = await this.authorization.read()
    if (!saved.tokens || !saved.redirectUrl) {
      throw new Error('Connect Trello from Orca’s Trello page first.')
    }
    const client = new Client({ name: 'orca-sky-trello', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(TRELLO_MCP_URL, {
      authProvider: this.provider(saved, saved.redirectUrl, undefined, undefined, generation)
    })
    return client
      .connect(transport, { timeout: 30000 })
      .then(async () => {
        if (generation !== this.generation) {
          await client.close().catch(() => {})
          throw new Error('Trello connection was cancelled.')
        }
        return client
      })
      .catch(async () => {
        await client.close().catch(() => {})
        throw new Error('Trello is unavailable or authorization expired. Refresh or connect again.')
      })
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const client = await this.ready()
    const raw = await client
      .callTool({ name: tool, arguments: args }, undefined, { timeout: 30000 })
      .catch(async (error: unknown) => {
        if (this.client === client) {
          this.client = null
        }
        await client.close().catch(() => {})
        // The next user action may reconnect; a failed write is never replayed here.
        throw error
      })
    const result = CallToolResultSchema.parse(raw)
    if (result.isError) {
      throw new Error('Trello rejected the request. Refresh the card before continuing.')
    }
    if (result.structuredContent) {
      return result.structuredContent
    }
    for (const item of result.content) {
      if (item.type === 'text') {
        try {
          return JSON.parse(item.text)
        } catch {
          /* Try the next structured text block. */
        }
      }
    }
    throw new Error('Trello returned an unreadable response.')
  }
}
