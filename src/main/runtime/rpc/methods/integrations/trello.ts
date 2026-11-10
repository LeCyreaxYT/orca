import { defineMethod, defineStreamingMethod } from '../../core'
import { bindStructuredAgentSessionStream } from '../structured-sessions/subscriptions/structured-agent-session-status-stream'
import { getTrelloHost } from '../../../../trello/trello-host'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../../shared/execution-host'
import {
  TrelloBindParams,
  TrelloBoardParams,
  TrelloCardParams,
  TrelloCheckParams,
  TrelloCommentsParams,
  TrelloConfigureParams,
  TrelloCreateParams,
  TrelloLinkParams,
  TrelloOperationParams,
  TrelloPrepareParams,
  TrelloProgressParams,
  TrelloRunParams
} from '../../../../../shared/rpc-contract/trello-params'

export const TRELLO_METHODS = [
  defineMethod({
    name: 'trello.link',
    permission: 'workspace',
    params: TrelloLinkParams,
    handler: async (params, context) => {
      const records = context.runtime.openedAgentSessionRecordStore()
      const caller = context.orchestrationCaller
      const record = caller ? records?.getRecord(caller.sessionId) : null
      if (caller && !record) {
        throw new Error('The requesting Orca chat is no longer available.')
      }
      const current = record?.location.workspaceId
      const selector =
        params.worktree ??
        (current ? (current.startsWith('folder:') ? current : `id:${current}`) : 'current')
      const { worktree } = await context.runtime.listWorkspaceReferences(selector, params.cwd)
      if (worktree.hostId && worktree.hostId !== LOCAL_EXECUTION_HOST_ID) {
        throw new Error('Link Trello from the Orca host that owns this workspace.')
      }
      if (
        record &&
        (record.location.workspaceId !== worktree.id ||
          record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID)
      ) {
        throw new Error('The Trello task must belong to the requesting chat’s workspace and host.')
      }
      if (record && record.provider !== 'codex' && record.provider !== 'claude') {
        throw new Error('Trello chat links currently support Codex and Claude.')
      }
      const service = (await getTrelloHost()).service
      const result = await service.prepare(params.cardId, worktree.id)
      const tabId = record ? records?.getSessionTabId(record.sessionId) : null
      if (record && tabId) {
        return {
          ...result,
          run: service.bind(result.run.id, record.sessionId, tabId, record.provider),
          bound: true
        }
      }
      return { ...result, bound: false }
    }
  }),
  defineStreamingMethod({
    name: 'trello.watch',
    permission: 'workspace',
    params: null,
    handler: async (_params, ctx, emit) => {
      const { service } = await getTrelloHost()
      let dispose = (): void => {}
      const stream = bindStructuredAgentSessionStream(
        ctx,
        `trello:${ctx.connectionId ?? 'local'}:${ctx.requestId ?? 'watch'}`,
        () => dispose()
      )
      if (stream.isClosed()) {
        return
      }
      dispose = service.store.subscribe(() => emit({ type: 'changed' }))
      emit({ type: 'ready' })
    }
  }),
  defineMethod({
    name: 'trello.status',
    permission: 'workspace',
    params: null,
    handler: async () => {
      const { service, connection } = await getTrelloHost()
      const state = service.store.read()
      return {
        ...connection.status(),
        selectedBoardId: state.selectedBoardId,
        runs: Object.values(state.runs)
      }
    }
  }),
  defineMethod({
    name: 'trello.connect',
    permission: 'accounts-admin',
    params: null,
    handler: async () => (await getTrelloHost()).connection.beginAuthorization()
  }),
  defineMethod({
    name: 'trello.disconnect',
    permission: 'accounts-admin',
    params: null,
    handler: async () => (await getTrelloHost()).connection.disconnect()
  }),
  defineMethod({
    name: 'trello.cancelConnect',
    permission: 'accounts-admin',
    params: null,
    handler: async () => (await getTrelloHost()).connection.dispose()
  }),
  defineMethod({
    name: 'trello.boards',
    permission: 'workspace',
    params: null,
    handler: async () => (await getTrelloHost()).service.read.boards()
  }),
  defineMethod({
    name: 'trello.board',
    permission: 'workspace',
    params: TrelloBoardParams,
    handler: async ({ boardId }) => (await getTrelloHost()).service.board(boardId)
  }),
  defineMethod({
    name: 'trello.card',
    permission: 'workspace',
    params: TrelloCardParams,
    handler: async ({ cardId }) => (await getTrelloHost()).service.read.card(cardId)
  }),
  defineMethod({
    name: 'trello.comments',
    permission: 'workspace',
    params: TrelloCommentsParams,
    handler: async ({ cardId, cursor }) =>
      (await getTrelloHost()).service.read.call('trelloReadCard', {
        action: 'list_comments',
        cardIdOrUrl: cardId,
        limit: 50,
        ...(cursor ? { cursor } : {})
      })
  }),
  defineMethod({
    name: 'trello.configure',
    permission: 'workspace',
    params: TrelloConfigureParams,
    handler: async ({ boardId, workflow }, context) => {
      if (context.caller?.kind !== 'desktop') {
        throw new Error('The user configures Trello workflow lists in the Orca desktop UI.')
      }
      return (await getTrelloHost()).service.configure(boardId, workflow)
    }
  }),
  defineMethod({
    name: 'trello.prepare',
    permission: 'workspace',
    params: TrelloPrepareParams,
    handler: async ({ cardId, worktreeId }) =>
      (await getTrelloHost()).service.prepare(cardId, worktreeId)
  }),
  defineMethod({
    name: 'trello.bind',
    permission: 'workspace',
    params: TrelloBindParams,
    handler: async ({ runId, sessionId, tabId, agent }) =>
      (await getTrelloHost()).service.bind(runId, sessionId, tabId, agent)
  }),
  defineMethod({
    name: 'trello.start',
    permission: 'workspace',
    params: TrelloRunParams,
    handler: async ({ runId }) => (await getTrelloHost()).service.start(runId)
  }),
  defineMethod({
    name: 'trello.progress',
    permission: 'workspace',
    params: TrelloProgressParams,
    handler: async (params) => (await getTrelloHost()).service.progress(params)
  }),
  defineMethod({
    name: 'trello.review',
    permission: 'workspace',
    params: TrelloProgressParams,
    handler: async (params) => (await getTrelloHost()).service.progress(params, true)
  }),
  defineMethod({
    name: 'trello.accept',
    permission: 'workspace',
    params: TrelloRunParams,
    handler: async ({ runId }, context) => {
      if (context.caller?.kind !== 'desktop') {
        throw new Error('Final Trello acceptance belongs to the user in the Orca desktop UI.')
      }
      return (await getTrelloHost()).service.accept(runId)
    }
  }),
  defineMethod({
    name: 'trello.check',
    permission: 'workspace',
    params: TrelloCheckParams,
    handler: async (params, context) => {
      if (context.caller?.kind !== 'desktop') {
        throw new Error('Use trello.progress with evidence for agent checklist updates.')
      }
      return (await getTrelloHost()).service.check(params)
    }
  }),
  defineMethod({
    name: 'trello.create',
    permission: 'workspace',
    params: TrelloCreateParams,
    handler: async (params, context) =>
      (await getTrelloHost()).service.create(params, context.caller?.kind === 'desktop')
  }),
  defineMethod({
    name: 'trello.operation',
    permission: 'workspace',
    params: TrelloOperationParams,
    handler: async ({ requestId }) =>
      (await getTrelloHost()).service.store.read().operations[requestId] ?? null
  })
]
