import type { CommandSpec } from '../args'
import { GLOBAL_FLAGS } from '../args'

export const TRELLO_COMMAND_SPECS: CommandSpec[] = [
  {
    path: ['trello', 'link'],
    summary: 'Link a Trello card to this workspace and current native chat',
    usage: 'orca trello link --card <id-or-url> [--worktree <selector>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'card', 'worktree']
  },
  {
    path: ['trello', 'status'],
    summary: 'Show Orca Trello connection and linked runs',
    usage: 'orca trello status [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['trello', 'boards'],
    summary: 'List connected Trello boards',
    usage: 'orca trello boards [--json]',
    allowedFlags: [...GLOBAL_FLAGS]
  },
  {
    path: ['trello', 'board'],
    summary: 'Read a Trello board with its original lists',
    usage: 'orca trello board --board <id-or-url> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'board']
  },
  {
    path: ['trello', 'card'],
    summary: 'Read a complete Trello card and checklists',
    usage: 'orca trello card --card <id-or-url> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'card']
  },
  {
    path: ['trello', 'comments'],
    summary: 'Read a page of Trello card history',
    usage: 'orca trello comments --card <id-or-url> [--cursor <cursor>] [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'card', 'cursor']
  },
  {
    path: ['trello', 'start'],
    summary: 'Begin a linked Trello task',
    usage: 'orca trello start --run <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'run']
  },
  {
    path: ['trello', 'progress'],
    summary: 'Record verified progress without replacing the card layout',
    usage: 'orca trello progress --data-file <json-file> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'data-file']
  },
  {
    path: ['trello', 'review'],
    summary: 'Submit results to Test/Acceptance for the user',
    usage: 'orca trello review --data-file <json-file> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'data-file']
  },
  {
    path: ['trello', 'create'],
    summary: 'Create a Trello card, optionally from a card template',
    usage: 'orca trello create --data-file <json-file> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'data-file']
  },
  {
    path: ['trello', 'operation'],
    summary: 'Inspect a Trello write receipt before retrying',
    usage: 'orca trello operation --request <id> [--json]',
    allowedFlags: [...GLOBAL_FLAGS, 'request']
  }
]
