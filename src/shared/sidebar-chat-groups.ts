import { z } from 'zod'
import { normalizeExecutionHostId, type ExecutionHostId } from './execution-host'

export const PINNED_CHAT_GROUP = 'pinned'
export const GENERAL_CHAT_GROUP = 'general'

export const SidebarChatSource = z.object({
  agent: z.enum(['codex', 'claude']),
  path: z.string().min(1).max(4096),
  projectId: z.string().min(1).max(256).optional(),
  executionHostId: z.custom<ExecutionHostId>(
    (value) => typeof value === 'string' && normalizeExecutionHostId(value) === value
  )
})
export type SidebarChatSource = z.infer<typeof SidebarChatSource>

const WorkspaceChatGroups = z.object({
  groups: z
    .array(z.object({ id: z.string().min(1).max(128), name: z.string().trim().min(1).max(80) }))
    .max(100),
  assignments: z.record(z.string(), z.string()),
  collapsed: z.array(z.string()).max(102),
  sources: z.array(SidebarChatSource).max(64).optional(),
  workspaceCollapsed: z.boolean().optional()
})

export type SidebarChatGroups = z.infer<typeof WorkspaceChatGroups>
export type SidebarChatGroupsByWorktree = Record<string, SidebarChatGroups>

export const EMPTY_SIDEBAR_CHAT_GROUPS: SidebarChatGroups = {
  groups: [],
  assignments: {},
  collapsed: []
}

function groupIds(state: SidebarChatGroups): Set<string> {
  return new Set([PINNED_CHAT_GROUP, GENERAL_CHAT_GROUP, ...state.groups.map((group) => group.id)])
}

export function normalizeSidebarChatGroups(value: unknown): SidebarChatGroupsByWorktree {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const result: SidebarChatGroupsByWorktree = {}
  for (const [workspaceId, candidate] of Object.entries(value)) {
    const parsed = WorkspaceChatGroups.safeParse(candidate)
    if (!parsed.success) {
      continue
    }
    const ids = new Set([PINNED_CHAT_GROUP, GENERAL_CHAT_GROUP])
    const groups = parsed.data.groups.filter((group) => {
      if (ids.has(group.id)) {
        return false
      }
      ids.add(group.id)
      return true
    })
    result[workspaceId] = {
      ...parsed.data,
      groups,
      assignments: Object.fromEntries(
        Object.entries(parsed.data.assignments).filter(([, id]) => ids.has(id))
      ),
      collapsed: [...new Set(parsed.data.collapsed.filter((id) => ids.has(id)))]
    }
  }
  return result
}

export const SidebarChatGroupsParam = z.record(z.string(), WorkspaceChatGroups)

export type SidebarChatGroupEdit =
  | { kind: 'add'; id: string; name: string }
  | { kind: 'rename'; id: string; name: string }
  | { kind: 'remove'; id: string }
  | { kind: 'move'; chatId: string; groupId: string }
  | { kind: 'toggle'; id: string }
  | { kind: 'sources'; sources: SidebarChatSource[] }
  | { kind: 'toggle-workspace' }

export function editSidebarChatGroups(
  state: SidebarChatGroups,
  edit: SidebarChatGroupEdit
): SidebarChatGroups {
  const ids = groupIds(state)
  switch (edit.kind) {
    case 'sources':
      return { ...state, sources: z.array(SidebarChatSource).max(64).parse(edit.sources) }
    case 'toggle-workspace':
      return { ...state, workspaceCollapsed: !state.workspaceCollapsed }
    case 'add':
      if (ids.has(edit.id) || !edit.name.trim() || state.groups.length >= 100) {
        return state
      }
      return {
        ...state,
        groups: [...state.groups, { id: edit.id, name: edit.name.trim().slice(0, 80) }]
      }
    case 'rename':
      if (!edit.name.trim() || !state.groups.some((group) => group.id === edit.id)) {
        return state
      }
      return {
        ...state,
        groups: state.groups.map((group) =>
          group.id === edit.id ? { ...group, name: edit.name.trim().slice(0, 80) } : group
        )
      }
    case 'remove':
      if (!state.groups.some((group) => group.id === edit.id)) {
        return state
      }
      return {
        ...state,
        groups: state.groups.filter((group) => group.id !== edit.id),
        assignments: Object.fromEntries(
          Object.entries(state.assignments).map(([chatId, id]) => [
            chatId,
            id === edit.id ? GENERAL_CHAT_GROUP : id
          ])
        ),
        collapsed: state.collapsed.filter((id) => id !== edit.id)
      }
    case 'move': {
      if (!ids.has(edit.groupId)) {
        return state
      }
      const assignments = { ...state.assignments }
      assignments[edit.chatId] = edit.groupId
      return {
        ...state,
        assignments,
        collapsed: state.collapsed.filter((id) => id !== edit.groupId)
      }
    }
    case 'toggle':
      if (!ids.has(edit.id)) {
        return state
      }
      return {
        ...state,
        collapsed: state.collapsed.includes(edit.id)
          ? state.collapsed.filter((id) => id !== edit.id)
          : [...state.collapsed, edit.id]
      }
  }
}
