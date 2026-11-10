import { describe, expect, it } from 'vitest'
import {
  editSidebarChatGroups,
  EMPTY_SIDEBAR_CHAT_GROUPS,
  normalizeSidebarChatGroups
} from './sidebar-chat-groups'

describe('sidebar chat organization', () => {
  it('restores a renamed group with the same chat membership after serialization', () => {
    let state = editSidebarChatGroups(EMPTY_SIDEBAR_CHAT_GROUPS, {
      kind: 'add',
      id: 'support',
      name: 'Support'
    })
    state = editSidebarChatGroups(state, {
      kind: 'move',
      chatId: 'native-parent:leaf',
      groupId: 'support'
    })
    state = editSidebarChatGroups(state, { kind: 'rename', id: 'support', name: 'Tickets' })
    state = editSidebarChatGroups(state, { kind: 'toggle', id: 'support' })
    const restored = normalizeSidebarChatGroups(JSON.parse(JSON.stringify({ scripts: state })))
    expect(restored.scripts).toEqual({
      groups: [{ id: 'support', name: 'Tickets' }],
      assignments: { 'native-parent:leaf': 'support' },
      collapsed: ['support']
    })
  })

  it('returns members to the default list when their group is removed', () => {
    const next = editSidebarChatGroups(
      {
        groups: [{ id: 'release', name: 'Release' }],
        assignments: { parent: 'release', other: 'pinned' },
        collapsed: ['release']
      },
      { kind: 'remove', id: 'release' }
    )
    expect(next).toEqual({
      groups: [],
      assignments: { parent: 'general', other: 'pinned' },
      collapsed: []
    })
  })

  it('keeps valid workspaces when an old or invalid workspace entry cannot be restored', () => {
    expect(
      normalizeSidebarChatGroups({
        broken: null,
        scripts: {
          groups: [],
          assignments: { chat: 'missing', pinnedChat: 'pinned' },
          collapsed: ['missing', 'general']
        }
      })
    ).toEqual({
      scripts: { groups: [], assignments: { pinnedChat: 'pinned' }, collapsed: ['general'] }
    })
  })

  it('does not assign a chat to a group removed before an asynchronous launch completes', () => {
    const next = editSidebarChatGroups(EMPTY_SIDEBAR_CHAT_GROUPS, {
      kind: 'move',
      chatId: 'new-session:leaf',
      groupId: 'removed'
    })
    expect(next.assignments).toEqual({})
  })

  it('opens the destination when a chat is moved into a collapsed group', () => {
    const next = editSidebarChatGroups(
      {
        groups: [{ id: 'support', name: 'Support' }],
        assignments: {},
        collapsed: ['support', 'pinned']
      },
      { kind: 'move', chatId: 'chat:leaf', groupId: 'support' }
    )
    expect(next.collapsed).toEqual(['pinned'])
    expect(next.assignments).toEqual({ 'chat:leaf': 'support' })
  })
})
