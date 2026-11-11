import type { AiVaultSession } from '../contracts/ai-vault-types'

export function aiVaultSessionListMetadata(session: AiVaultSession): AiVaultSession {
  if (session.previewMessages.length === 0) {
    return session
  }
  const content =
    session.messageCount > 0
      ? undefined
      : session.previewMessages.find(
          (message) => message.role === 'user' || message.role === 'assistant'
        )
  return { ...session, previewMessages: content ? [content] : [] }
}
