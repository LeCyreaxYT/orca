import { randomBytes } from 'node:crypto'
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { TrelloAuthorization } from './trello-authorization-store'

export const TRELLO_MCP_URL = new URL('https://mcp.trello.com/v1')
// Atlassian consent rejects partial scope groups; discover them from the server.
export const TRELLO_AUTH_OPTIONS = {
  serverUrl: TRELLO_MCP_URL,
  resourceMetadataUrl: new URL('https://mcp.trello.com/.well-known/oauth-protected-resource/v1'),
  fetchFn: (input: string | URL | Request, init?: RequestInit) =>
    fetch(input, {
      ...init,
      signal: AbortSignal.any([...(init?.signal ? [init.signal] : []), AbortSignal.timeout(30000)])
    })
}

export function createTrelloOAuthProvider(
  saved: TrelloAuthorization,
  redirectUrl: string,
  save: () => void | Promise<void>,
  onRedirect?: (url: URL) => void,
  state?: string
): OAuthClientProvider {
  let verifier = ''
  return {
    redirectUrl,
    clientMetadata: {
      client_name: 'Orca Sky',
      redirect_uris: [redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none'
    },
    state: () => state ?? randomBytes(32).toString('hex'),
    clientInformation: () => saved.client,
    saveClientInformation: (value) => {
      saved.client = value
    },
    tokens: () => saved.tokens,
    saveTokens: async (value) => {
      saved.tokens = value
      saved.redirectUrl = redirectUrl
      await save()
    },
    saveCodeVerifier: (value) => {
      verifier = value
    },
    codeVerifier: () => verifier,
    redirectToAuthorization: (url) => {
      if (!onRedirect) {
        throw new Error('Connect Trello again from Orca’s Trello page.')
      }
      if (url.protocol !== 'https:') {
        throw new Error('Trello returned an invalid authorization URL.')
      }
      onRedirect(url)
    },
    invalidateCredentials: (scope) => {
      if (scope === 'all' || scope === 'client') {
        saved.client = undefined
      }
      if (scope === 'all' || scope === 'tokens') {
        saved.tokens = undefined
      }
      if (scope === 'all' || scope === 'verifier') {
        verifier = ''
      }
    }
  }
}
