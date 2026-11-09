import { useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useNewTabAgentMenuRows } from '@/components/tab-bar/use-new-tab-agent-menu-rows'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { captureNativeChatComposerFocusIntent } from '@/components/native-chat/composer/focus/native-chat-composer-focus-intent'
import { useTranslate } from '@/i18n/use-translate'
import type { NewTabAgentMenuRow } from '../../../../../../shared/agent-launch/picker/agent-launch-picker-rows'
import { GENERAL_CHAT_GROUP } from '../../../../../../shared/sidebar-chat-groups'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../../../../../shared/agent-session/view/structured-agent-session-projection'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'

type Props = { worktreeId: string; sidebarGroupId?: string; disabled?: boolean }

function ChatChoices({
  worktreeId,
  sidebarGroupId = GENERAL_CHAT_GROUP,
  onLaunch
}: Props & { onLaunch: () => void }) {
  const t = useTranslate()
  const target = useAgentDetectionTargetForWorktree(worktreeId)
  const model = useNewTabAgentMenuRows(worktreeId, true, target, { wakeOnOpen: true })
  const launch = (row: NewTabAgentMenuRow) => {
    if (row.kind !== 'chat') {
      return
    }
    const result = launchAgentInNewTab({
      requestId: newAgentLaunchRequestId(),
      focusIntent: captureNativeChatComposerFocusIntent(),
      agent: row.agent,
      worktreeId,
      requestedSurface: 'chat',
      selectedExecutionHostId: row.executionHostId
    })
    if (!result || 'refused' in result) {
      return
    }
    onLaunch()
    void result.structuredSettlement
      ?.then((settlement) => {
        if (settlement.kind === 'structured') {
          const tabId =
            result.surface.kind === 'local-chat'
              ? result.surface.tabId
              : structuredAgentSessionTabId(settlement.sessionId)
          useAppStore.getState().editSidebarChatGroup(worktreeId, {
            kind: 'move',
            chatId: structuredAgentSessionPaneKey(tabId, settlement.sessionId),
            groupId: sidebarGroupId
          })
        }
      })
      .catch(console.error)
  }
  if (model.state === 'loading') {
    return (
      <DropdownMenuItem disabled>
        {t('sidebar.chatGroups.loading', 'Loading chats…')}
      </DropdownMenuItem>
    )
  }
  const rows = model.rows.filter((row) => row.kind === 'chat' || row.kind === 'chat-unavailable')
  return rows.length ? (
    rows.map((row) => (
      <DropdownMenuItem
        key={`${row.agent}:${row.executionHostId}`}
        disabled={row.kind !== 'chat'}
        onSelect={() => launch(row)}
      >
        <AgentIcon agent={row.agent} size={14} />
        {getAgentLabel(row.agent)}
        {row.kind === 'chat-unavailable' ? (
          <span className="ml-auto text-xs text-muted-foreground">
            {t('sidebar.chatGroups.unavailable', 'Unavailable')}
          </span>
        ) : null}
      </DropdownMenuItem>
    ))
  ) : (
    <DropdownMenuItem disabled>
      {t('sidebar.chatGroups.noProviders', 'No chat providers available')}
    </DropdownMenuItem>
  )
}

export function WorkspaceNewChatButton(props: Props) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const launched = useRef(false)
  const label = t('sidebar.chatGroups.newChat', 'New chat')
  return (
    <DropdownMenu
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          launched.current = false
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              disabled={props.disabled}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <Plus className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
        onCloseAutoFocus={(event) => {
          if (launched.current) {
            event.preventDefault()
          }
        }}
      >
        {open ? (
          <ChatChoices
            {...props}
            onLaunch={() => {
              launched.current = true
            }}
          />
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
