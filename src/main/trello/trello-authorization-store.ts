import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  OAuthClientInformationMixed,
  OAuthTokens
} from '@modelcontextprotocol/sdk/shared/auth.js'
import {
  credentialFileHasContent,
  readStoredCredentialToken,
  writeCredentialFileAtomic,
  writeEncryptedCredential
} from '../credentials/integration-credential-file'
import { readCredentialFileProtection } from '../credentials/credential-file-protection'

export type TrelloAuthorization = {
  redirectUrl?: string
  client?: OAuthClientInformationMixed
  tokens?: OAuthTokens
}

export function createTrelloAuthorizationStore(directory: string) {
  const path = join(directory, 'authorization.enc')
  return {
    async read(): Promise<TrelloAuthorization> {
      try {
        const text = readStoredCredentialToken('Trello', await readFile(path))
        return text ? JSON.parse(text) : {}
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          return {}
        }
        throw error
      }
    },
    async save(value: TrelloAuthorization, canPublish?: () => boolean): Promise<void> {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      if (canPublish && !canPublish()) {
        throw new Error('Trello authorization was cancelled.')
      }
      if (!value.tokens) {
        writeCredentialFileAtomic(path, Buffer.alloc(0))
        return
      }
      writeEncryptedCredential('Trello', path, JSON.stringify(value))
    },
    status() {
      return {
        connected: credentialFileHasContent(path),
        credentialProtection: readCredentialFileProtection(path)
      }
    }
  }
}
