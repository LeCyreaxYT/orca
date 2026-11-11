import type { UISlice, UISliceGet, UISliceSet } from './ui-slice-contract'
import {
  editSidebarChatGroups,
  moveSidebarChatToWorkspace,
  EMPTY_SIDEBAR_CHAT_GROUPS
} from '../../../../../shared/sidebar-chat-groups'
import { findKnownWorktreeById } from '../worktrees/listing/detected-worktree-meta'

export function createSidebarChatPreferenceActions(
  set: UISliceSet,
  get: UISliceGet
): Pick<
  UISlice,
  'sidebarChatGroupsByWorktree' | 'editSidebarChatGroup' | 'moveSidebarChatToWorkspace'
> {
  return {
    sidebarChatGroupsByWorktree: {},
    editSidebarChatGroup: (worktreeId, edit) =>
      set((state) => ({
        sidebarChatGroupsByWorktree:
          edit.kind === 'move'
            ? moveSidebarChatToWorkspace(
                state.sidebarChatGroupsByWorktree,
                worktreeId,
                worktreeId,
                edit.chatId,
                edit.groupId
              )
            : {
                ...state.sidebarChatGroupsByWorktree,
                [worktreeId]: editSidebarChatGroups(
                  state.sidebarChatGroupsByWorktree[worktreeId] ?? EMPTY_SIDEBAR_CHAT_GROUPS,
                  edit
                )
              }
      })),
    moveSidebarChatToWorkspace: (fromId, toId, chatId) => {
      const state = get()
      const from = findKnownWorktreeById(state, fromId)
      const to = findKnownWorktreeById(state, toId)
      if (!from || !to || to.isArchived || (from.hostId ?? 'local') !== (to.hostId ?? 'local')) {
        return
      }
      set({
        sidebarChatGroupsByWorktree: moveSidebarChatToWorkspace(
          state.sidebarChatGroupsByWorktree,
          fromId,
          toId,
          chatId
        )
      })
    }
  }
}
