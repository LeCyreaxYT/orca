import { readFile } from 'node:fs/promises'
import type { CommandHandler, HandlerContext } from '../dispatch'
import { getOptionalStringFlag, getRequiredStringFlag } from '../flags'
import { printResult } from '../format'
import { TrelloCreateParams, TrelloProgressParams } from '../../shared/rpc-contract/trello-params'
import { getOptionalWorktreeSelector } from '../selectors'
import { RuntimeClientError } from '../runtime-client'

async function call(context: HandlerContext, method: string, params?: unknown) {
  const result = await context.client.call(method, params)
  printResult(result, context.json, (value) => JSON.stringify(value, null, 2))
}

async function write(
  context: HandlerContext,
  method: 'trello.progress' | 'trello.review' | 'trello.create'
) {
  const path = getRequiredStringFlag(context.flags, 'data-file')
  const data: unknown = JSON.parse(await readFile(path, 'utf8'))
  const params =
    method === 'trello.create' ? TrelloCreateParams.parse(data) : TrelloProgressParams.parse(data)
  await call(context, method, params)
}

export const TRELLO_HANDLERS: Record<string, CommandHandler> = {
  'trello link': async (context) => {
    const worktree = await getOptionalWorktreeSelector(
      context.flags,
      'worktree',
      context.cwd,
      context.client
    )
    if (context.client.isRemote && !worktree) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Choose an explicit remote workspace with --worktree.'
      )
    }
    await call(context, 'trello.link', {
      cardId: getRequiredStringFlag(context.flags, 'card'),
      worktree,
      ...(context.client.isRemote ? {} : { cwd: context.cwd })
    })
  },
  'trello status': (context) => call(context, 'trello.status'),
  'trello boards': (context) => call(context, 'trello.boards'),
  'trello board': (context) =>
    call(context, 'trello.board', { boardId: getRequiredStringFlag(context.flags, 'board') }),
  'trello card': (context) =>
    call(context, 'trello.card', { cardId: getRequiredStringFlag(context.flags, 'card') }),
  'trello comments': (context) =>
    call(context, 'trello.comments', {
      cardId: getRequiredStringFlag(context.flags, 'card'),
      cursor: getOptionalStringFlag(context.flags, 'cursor')
    }),
  'trello start': (context) =>
    call(context, 'trello.start', { runId: getRequiredStringFlag(context.flags, 'run') }),
  'trello progress': (context) => write(context, 'trello.progress'),
  'trello review': (context) => write(context, 'trello.review'),
  'trello create': (context) => write(context, 'trello.create'),
  'trello operation': (context) =>
    call(context, 'trello.operation', {
      requestId: getRequiredStringFlag(context.flags, 'request')
    })
}
