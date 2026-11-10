import type { HandlerGroup } from './handler-group-manifest'

export const TRELLO_HANDLER_GROUP: HandlerGroup = {
  name: 'trello',
  keys: [
    'trello link',
    'trello status',
    'trello boards',
    'trello board',
    'trello card',
    'trello comments',
    'trello start',
    'trello progress',
    'trello review',
    'trello create',
    'trello operation'
  ],
  load: async () => (await import('./handlers/trello.js')).TRELLO_HANDLERS
}
