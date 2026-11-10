import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
import { SidebarChatCustomGroupMenu, SidebarChatRowMenu } from './SidebarChatGroupControls'
import { WorkspaceNewChatButton } from './WorkspaceNewChatButton'
import {
  SidebarChatDragProvider,
  SidebarChatDropGroup,
  SidebarChatDraggable,
  SidebarChatDraggableRow
} from './SidebarChatGroupDrag'
import { useSidebarWorkspaceHistory } from '../../chat-sources/use-sidebar-workspace-history'
import { useSidebarChatHistory } from '../../chat-sources/sidebar-chat-history-store'
import { SidebarHistoryChatRow } from '../../chat-sources/SidebarHistoryChatRow'
import { sidebarHistoryChatId } from '../../../../../../shared/sidebar-chat-sources'
import type { AiVaultSession } from '../../../../../../shared/ai-vault/contracts/ai-vault-types'
import {
  sidebarChatGroup,
  sidebarChatIdentity,
  visibleSidebarChats
} from './sidebar-chat-group-model'

const NO_FOCUS: ReadonlySet<string> = new Set()
const NO_SIGNALS: ReadonlyMap<string, AgentDotState> = new Map()
type ChatItem =
  | { agent: DashboardAgentRow; session?: never }
  | { session: AiVaultSession; agent?: never }

export function SidebarChatGroups({
  worktreeId,
  agents,
  renderAgent,
  pinnedOnly = false,
  focused = NO_FOCUS,
  childSignals = NO_SIGNALS
}: {
  worktreeId: string
  agents: readonly DashboardAgentRow[]
  renderAgent: (agent: DashboardAgentRow) => ReactNode
  pinnedOnly?: boolean
  focused?: ReadonlySet<string>
  childSignals?: ReadonlyMap<string, AgentDotState>
}) {
  const t = useTranslate()
  const state = useAppStore(
    (store) => store.sidebarChatGroupsByWorktree[worktreeId] ?? EMPTY_SIDEBAR_CHAT_GROUPS
  )
  const editGroup = useAppStore((store) => store.editSidebarChatGroup)
  const workspaceHistory = useSidebarWorkspaceHistory(worktreeId)
  const history = useMemo(() => {
    const represented = new Set(agents.map(sidebarChatIdentity))
    return workspaceHistory.filter((session) => !represented.has(sidebarHistoryChatId(session)))
  }, [agents, workspaceHistory])
  const pinned = useSidebarChatHistory((store) => store.structure.pinned)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const edit = (change: Parameters<typeof editGroup>[1]) => editGroup(worktreeId, change)
  const options = useMemo(
    () => [
      { id: PINNED_CHAT_GROUP, name: t('sidebar.chatGroups.pinned', 'Pinned') },
      { id: GENERAL_CHAT_GROUP, name: t('sidebar.chatGroups.general', 'General') },
      ...state.groups
    ],
    [state.groups, t]
  )
  const groups = useMemo(() => {
    const buckets = new Map<string, ChatItem[]>(options.map((option) => [option.id, []]))
    for (const agent of agents) {
      const groupId = sidebarChatGroup(agent, state, pinned)
      ;(buckets.get(groupId) ?? buckets.get(GENERAL_CHAT_GROUP)!).push({
        agent
      })
    }
    for (const session of history) {
      const groupId =
        state.assignments[sidebarHistoryChatId(session)] ??
        (session.agent === 'codex' &&
        session.executionHostId === 'local' &&
        pinned.includes(session.sessionId)
          ? PINNED_CHAT_GROUP
          : GENERAL_CHAT_GROUP)
      ;(buckets.get(groupId) ?? buckets.get(GENERAL_CHAT_GROUP)!).push({ session })
    }
    const updatedAt = (row: ChatItem) =>
      row.agent
        ? row.agent.entry.updatedAt
        : Date.parse(row.session.updatedAt ?? row.session.modifiedAt)
    return options
      .map((option) => ({
        ...option,
        rows: buckets.get(option.id)!.sort((a, b) => updatedAt(b) - updatedAt(a))
      }))
      .filter(
        (group) =>
          (pinnedOnly ? group.id === PINNED_CHAT_GROUP : group.id !== PINNED_CHAT_GROUP) &&
          (group.rows.length > 0 || state.groups.some((custom) => custom.id === group.id))
      )
  }, [agents, history, pinned, state, options, pinnedOnly])
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
          const required = new Set(
            visibleSidebarChats(
              group.rows.flatMap((row) => (row.agent ? [row.agent] : [])),
              focused,
              childSignals,
              false
            ).filter(
              (agent) =>
                focused.has(agent.paneKey) ||
                childSignals.has(agent.paneKey) ||
                !['idle', 'done', 'unverifiable'].includes(agentRowDisplayDotState(agent))
            )
          )
          const visible = expanded.has(group.id)
            ? group.rows
            : group.rows.filter((row, index) => index < 5 || (row.agent && required.has(row.agent)))
          const signal = SUMMARY_STATE_ORDER.find((candidate) =>
            group.rows.some(
              (row) =>
                row.agent &&
                (agentRowDisplayDotState(row.agent) === candidate ||
                  childSignals.get(row.agent.paneKey) === candidate)
            )
          )
          const hasFocus = group.rows.some((row) => row.agent && focused.has(row.agent.paneKey))
          const bare = pinnedOnly || group.id === GENERAL_CHAT_GROUP
          return (
            <SidebarChatDropGroup key={group.id} id={group.id} name={group.name}>
              {!bare ? (
                <div className="group/chat-group mt-3 flex min-w-0 items-center gap-0.5 border-t border-sidebar-border/60 pt-2">
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
                    <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
                    {!open && signal && !['idle', 'done', 'unverifiable'].includes(signal) ? (
                      <AgentStateDot state={signal} size="sm" />
                    ) : null}
                  </button>
                  <div className="flex items-center opacity-0 group-hover/chat-group:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
                    {state.groups.some((custom) => custom.id === group.id) ? (
                      <SidebarChatCustomGroupMenu option={group} edit={edit} />
                    ) : null}
                    <WorkspaceNewChatButton worktreeId={worktreeId} sidebarGroupId={group.id} />
                  </div>
                </div>
              ) : null}
              {bare || open ? (
                <div className={cn('min-w-0', !bare && 'pl-2 @3xs/sidebar:pl-5')}>
                  {visible.map((item) => {
                    if (item.agent) {
                      const agent = item.agent
                      return (
                        <SidebarChatDraggable key={agent.paneKey} agent={agent}>
                          <div className="min-w-0 flex-1">{renderAgent(agent)}</div>
                          <div className="pointer-events-none shrink-0 pt-0.5 opacity-0 group-hover/chat-row:pointer-events-auto group-hover/chat-row:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100">
                            <SidebarChatRowMenu
                              worktreeId={worktreeId}
                              chatId={sidebarChatIdentity(agent)}
                              groupId={group.id}
                              options={options}
                            />
                          </div>
                        </SidebarChatDraggable>
                      )
                    }
                    return (
                      <SidebarChatDraggableRow
                        key={sidebarHistoryChatId(item.session)}
                        id={sidebarHistoryChatId(item.session)}
                        title={item.session.title}
                      >
                        <div className="min-w-0 flex-1">
                          <SidebarHistoryChatRow session={item.session} worktreeId={worktreeId} />
                        </div>
                        <div className="pointer-events-none shrink-0 pt-0.5 opacity-0 group-hover/chat-row:pointer-events-auto group-hover/chat-row:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100 has-[[data-state=open]]:pointer-events-auto has-[[data-state=open]]:opacity-100">
                          <SidebarChatRowMenu
                            worktreeId={worktreeId}
                            chatId={sidebarHistoryChatId(item.session)}
                            groupId={group.id}
                            options={options}
                          />
                        </div>
                      </SidebarChatDraggableRow>
                    )
                  })}
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
                        : t('sidebar.chatGroups.more', 'Show more')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </SidebarChatDropGroup>
          )
        })}
      </div>
    </SidebarChatDragProvider>
  )
}
