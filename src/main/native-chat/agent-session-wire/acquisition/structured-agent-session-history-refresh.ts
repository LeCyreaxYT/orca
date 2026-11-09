import { stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { agentJournalItemKey } from '../../../../shared/agent-session/journal/agent-session-journal-item-key'
import type { AgentSessionConversationView } from '../../../../shared/agent-session/lifecycle/agent-session-conversation-view'
import { agentSessionProviderHandleChainHead } from '../../../../shared/agent-session/lifecycle/agent-session-provider-handle'
import type { AgentSessionJournal } from '../../agent-session-journal/journal-store'
import type { JournalReplacementItem } from '../../agent-session-journal/context-epochs/journal-epoch-replacement'
import { prepareLegacyTranscriptImport } from '../../agent-session-journal/history-import/journal-legacy-import'
import type { StructuredAgentTranscriptImport } from '../../structured-agent-cli-conversations'
import { createHistoryCatchUpBatch } from './structured-agent-session-history-catch-up'
import { structuredAgentRuntimeMetadata } from '../../../runtime/agent-session/installation/structured-agent-runtime-metadata'
import type {
  StructuredAgentSessionHostDeps,
  StructuredAgentSessionHostSession
} from '../host/structured-agent-session-host-types'

export function createStructuredAgentSessionHistoryRefresh(
  getDeps: () => StructuredAgentSessionHostDeps,
  conversation: (id: string) => Promise<StructuredAgentSessionHostSession>,
  serialize: <T>(id: string, task: () => Promise<T>) => Promise<T>
) {
  return async (sessionId: string): Promise<{ imported: number }> => {
    const deps = getDeps()
    const session = await conversation(sessionId)
    const record = deps.store.getConversation(sessionId)
    const importer = record && structuredAgentRuntimeMetadata(record.provider)?.transcriptImport
    if (!record || !importer || !['codex', 'claude'].includes(record.provider)) {
      throw new Error('History reload is available for Codex and Claude chats.')
    }
    const head = agentSessionProviderHandleChainHead(record.providerHandleChain)
    if (!head) {
      return { imported: 0 }
    }
    const epoch = session.journal.cursor().epoch
    const assertCurrent = () => {
      const current = deps.store.getConversation(sessionId)
      const running = session.journal.runningTurn()
      if (
        !current ||
        session.journal.cursor().epoch !== epoch ||
        current.currentFence !== record.currentFence ||
        agentSessionProviderHandleChainHead(current.providerHandleChain)?.linkId !== head.linkId ||
        session.child?.phase === 'starting' ||
        (running && session.journal.itemFence(running.item.itemId) !== 0)
      ) {
        throw new Error('Wait until this Orca chat finishes, then reload its history.')
      }
    }
    assertCurrent()
    const workspaceCwd = await deps.resolveWorkspacePath?.(record.location.workspaceId)
    if (!workspaceCwd) {
      throw new Error('The conversation workspace is unavailable.')
    }
    const items = await readRefreshedAgentSessionHistory({
      record,
      importer,
      workspaceCwd,
      launchEnv: { ...process.env, ...(await deps.resolveLaunchEnv?.(record.provider)) },
      signal: AbortSignal.timeout(30_000)
    })
    return serialize(sessionId, async () => ({
      imported: await refreshAgentSessionJournal({
        journal: session.journal,
        items,
        fence: record.currentFence,
        assertCurrent
      })
    }))
  }
}

/** Read the newest known copy; adoption may have copied an external chat into a managed home. */
export async function readRefreshedAgentSessionHistory(input: {
  record: AgentSessionConversationView
  importer: StructuredAgentTranscriptImport
  workspaceCwd: string
  launchEnv: NodeJS.ProcessEnv
  signal: AbortSignal
}): Promise<JournalReplacementItem[]> {
  const head = agentSessionProviderHandleChainHead(input.record.providerHandleChain)
  if (!head) {
    return []
  }
  const stores = new Set<string>()
  let newest: { items: JournalReplacementItem[]; observedAt: number; modifiedAt: number } | null =
    null
  for (const accountHome of input.importer.accountHomeCandidates({
    settings: {},
    selectedAccountHome: input.record.accountHome
  })) {
    input.signal.throwIfAborted()
    const store = input.importer.conversationStore({ accountHome, launchEnv: input.launchEnv })
    if (!store || stores.has(store)) {
      continue
    }
    stores.add(store)
    const filePath = await input.importer.findTranscript({
      providerSessionId: head.handle.nativeId,
      store,
      launchEnv: input.launchEnv,
      workspaceCwd: input.workspaceCwd,
      strictErrors: true
    })
    input.signal.throwIfAborted()
    if (!filePath) {
      continue
    }
    const prepared = await prepareLegacyTranscriptImport({
      agent: input.record.provider,
      sessionId: head.handle.nativeId,
      options: {
        filePath,
        signal: input.signal,
        source: {
          providerSessionId: head.handle.nativeId,
          workspaceCwd: input.workspaceCwd,
          conversationStore: store
        }
      }
    })
    if (!prepared.ok) {
      throw new Error(prepared.error)
    }
    const observedAt = prepared.items.reduce(
      (latest, item) => Math.max(latest, item.observedAt ?? 0),
      0
    )
    const modifiedAt = (await stat(filePath)).mtimeMs
    if (
      !newest ||
      observedAt > newest.observedAt ||
      (observedAt === newest.observedAt && modifiedAt > newest.modifiedAt)
    ) {
      newest = { items: prepared.items, observedAt, modifiedAt }
    }
  }
  input.signal.throwIfAborted()
  if (!newest) {
    throw new Error('The original conversation history is unavailable on this host.')
  }
  return newest.items
}

/** Presentation only: keep native-owned rows, rewinds, submissions and the current epoch intact. */
export async function refreshAgentSessionJournal(input: {
  journal: AgentSessionJournal
  items: readonly JournalReplacementItem[]
  fence: number
  assertCurrent: () => void
}): Promise<number> {
  const { journal } = input
  const epoch = journal.cursor().epoch
  let imported = 0
  // Planning runs in the journal's write lane, after any event that arrived during the read.
  await journal.appendPlannedLifecycleBatch({
    settlementId: `history-refresh:${randomUUID()}`,
    fence: input.fence,
    plan: () => {
      input.assertCurrent()
      if (journal.cursor().epoch !== epoch) {
        throw new Error('The conversation changed while reloading. Try again.')
      }
      const batch = createHistoryCatchUpBatch()
      for (const item of input.items) {
        const key = agentJournalItemKey(item.identity)
        const existing = journal.item(key)
        if (existing) {
          if (
            journal.itemFence(key) !== 0 ||
            JSON.stringify(existing.body) === JSON.stringify(item.body)
          ) {
            continue
          }
        } else if (journal.hasRecordedItem(key)) {
          continue
        }
        // Codex native items use turn/ordinal keys; a live-owned turn already covers its transcript copy.
        if (item.turnScope?.kind === 'turn' && journal.itemFence(item.turnScope.turnItemId)) {
          continue
        }
        batch.push({
          kind: 'item',
          identity: item.identity,
          body: item.body,
          ownerFence: 0,
          turnScope: item.turnScope ?? existing?.turnScope ?? { kind: 'unknown' },
          ...(item.observedAt === undefined ? {} : { observedAt: item.observedAt }),
          ...(item.echoOf === undefined ? {} : { echoOf: item.echoOf })
        })
      }
      const plan = batch.finish('history-refresh', epoch)
      imported = plan.mutations.length
      return { mutations: plan.mutations, dispatches: [] }
    }
  })
  return imported
}
