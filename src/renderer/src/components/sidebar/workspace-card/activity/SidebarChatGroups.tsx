import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Folder, Pin } from 'lucide-react'
import { useAppStore } from '@/store'
import { AgentStateDot, type AgentDotState } from '@/components/AgentStateDot'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/utils'
import {
  EMPTY_SIDEBAR_CHAT_GROUPS,
  GENERAL_CHAT_GROUP,
  PINNED_CHAT_GROUP
} from '../../../../../../shared/sidebar-chat-groups'
import { agentRowDisplayDotState } from '@/lib/agent-status/presentation/agent-row-dot-state'
import { SUMMARY_STATE_ORDER } from './worktree-card-agent-summary'
import {
  SidebarChatAddGroup,
  SidebarChatCustomGroupMenu,
  SidebarChatRowMenu
} from './SidebarChatGroupControls'
import { WorkspaceNewChatButton } from './WorkspaceNewChatButton'
import {
  SidebarChatDragProvider,
  SidebarChatDropGroup,
  SidebarChatDraggable
} from './SidebarChatGroupDrag'
import {
  sidebarChatGroup,
  sidebarChatIdentity,
  visibleSidebarChats
} from './sidebar-chat-group-model'

const NO_FOCUS: ReadonlySet<string> = new Set()
const NO_SIGNALS: ReadonlyMap<string, AgentDotState> = new Map()

export function SidebarChatGroups({
  worktreeId,
  agents,
  renderAgent,
  focused = NO_FOCUS,
  childSignals = NO_SIGNALS
}: {
  worktreeId: string
  agents: readonly DashboardAgentRow[]
  renderAgent: (agent: DashboardAgentRow) => ReactNode
  focused?: ReadonlySet<string>
  childSignals?: ReadonlyMap<string, AgentDotState>
}) {
  const t = useTranslate()
  const state = useAppStore(
    (store) => store.sidebarChatGroupsByWorktree[worktreeId] ?? EMPTY_SIDEBAR_CHAT_GROUPS
  )
  const editGroup = useAppStore((store) => store.editSidebarChatGroup)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const edit = (change: Parameters<typeof editGroup>[1]) => editGroup(worktreeId, change)
  const groups = useMemo(() => {
    const options = [
      { id: PINNED_CHAT_GROUP, name: t('sidebar.chatGroups.pinned', 'Pinned') },
      ...state.groups,
      { id: GENERAL_CHAT_GROUP, name: t('sidebar.chatGroups.general', 'General') }
    ]
    const buckets = new Map<string, DashboardAgentRow[]>(options.map((option) => [option.id, []]))
    for (const agent of agents) {
      ;(buckets.get(sidebarChatGroup(agent, state)) ?? buckets.get(GENERAL_CHAT_GROUP)!).push(agent)
    }
    return options.map((option) => ({ ...option, rows: buckets.get(option.id)! }))
  }, [agents, state, t])
  return (
    <SidebarChatDragProvider onMove={(chatId, groupId) => edit({ kind: 'move', chatId, groupId })}>
      <div
        className="min-w-0 space-y-0.5"
        data-sidebar-chat-groups=""
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {groups.map((group) => {
          const open = !state.collapsed.includes(group.id)
          const visible = visibleSidebarChats(
            group.rows,
            focused,
            childSignals,
            expanded.has(group.id)
          )
          const signal = SUMMARY_STATE_ORDER.find((candidate) =>
            group.rows.some(
              (row) =>
                agentRowDisplayDotState(row) === candidate ||
                childSignals.get(row.paneKey) === candidate
            )
          )
          const hasFocus = group.rows.some((row) => focused.has(row.paneKey))
          return (
            <SidebarChatDropGroup key={group.id} id={group.id} name={group.name}>
              <div className="flex min-w-0 items-center gap-0.5 pt-1">
                <button
                  type="button"
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    hasFocus && !open && 'text-foreground'
                  )}
                  aria-expanded={open}
                  onClick={() => edit({ kind: 'toggle', id: group.id })}
                >
                  {open ? (
                    <ChevronDown className="size-3 shrink-0" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0" />
                  )}
                  {group.id === PINNED_CHAT_GROUP ? (
                    <Pin className="size-3 shrink-0" />
                  ) : (
                    <Folder className="size-3 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  {!open && signal && !['idle', 'done', 'unverifiable'].includes(signal) ? (
                    <AgentStateDot state={signal} size="sm" />
                  ) : null}
                  <span className="shrink-0 tabular-nums">{group.rows.length}</span>
                </button>
                {state.groups.some((custom) => custom.id === group.id) ? (
                  <SidebarChatCustomGroupMenu option={group} edit={edit} />
                ) : null}
                <WorkspaceNewChatButton worktreeId={worktreeId} sidebarGroupId={group.id} />
              </div>
              {open ? (
                <div className="min-w-0 pl-3">
                  {visible.map((agent) => (
                    <SidebarChatDraggable key={agent.paneKey} agent={agent}>
                      <div className="min-w-0 flex-1">{renderAgent(agent)}</div>
                      <div className="pt-0.5 opacity-0 group-hover/chat-row:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
                        <SidebarChatRowMenu
                          worktreeId={worktreeId}
                          chatId={sidebarChatIdentity(agent)}
                          groupId={group.id}
                          options={groups}
                        />
                      </div>
                    </SidebarChatDraggable>
                  ))}
                  {group.rows.length > 5 ? (
                    <button
                      type="button"
                      className="px-1.5 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setExpanded((current) => {
                          const next = new Set(current)
                          if (next.has(group.id)) {
                            next.delete(group.id)
                          } else {
                            next.add(group.id)
                          }
                          return next
                        })
                      }
                    >
                      {expanded.has(group.id)
                        ? t('sidebar.chatGroups.less', 'Show less')
                        : t('sidebar.chatGroups.all', 'Show all {{count}} chats', {
                            count: group.rows.length
                          })}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </SidebarChatDropGroup>
          )
        })}
        <SidebarChatAddGroup worktreeId={worktreeId} />
      </div>
    </SidebarChatDragProvider>
  )
}
