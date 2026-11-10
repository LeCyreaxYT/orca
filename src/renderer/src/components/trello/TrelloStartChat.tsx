import { useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { useNewTabAgentMenuRows } from '@/components/tab-bar/use-new-tab-agent-menu-rows'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import { captureNativeChatComposerFocusIntent } from '@/components/native-chat/composer/focus/native-chat-composer-focus-intent'
import { launchAgentInNewTab } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { getAgentLabel } from '@/lib/agent-catalog/agent-catalog'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import {
  structuredAgentSessionPaneKey,
  structuredAgentSessionTabId
} from '../../../../shared/agent-session/view/structured-agent-session-projection'
import { LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import type { TrelloBoard, TrelloCard, TrelloRun } from '../../../../shared/trello/trello-types'
import { trelloRpc } from './trello-rpc'

type Props = { worktreeId: string; card: TrelloCard; board: TrelloBoard }

function Choices({ worktreeId, card, board }: Props) {
  const t = useTranslate()
  const target = useAgentDetectionTargetForWorktree(worktreeId)
  const model = useNewTabAgentMenuRows(worktreeId, true, target, { wakeOnOpen: true })
  const [busy, setBusy] = useState(false)
  const launching = useRef(false)
  if (model.state === 'loading') {
    return (
      <DropdownMenuItem disabled>{t('trello.loadingAgents', 'Loading agents…')}</DropdownMenuItem>
    )
  }
  const rows = model.rows.filter(
    (row) =>
      (row.agent === 'codex' || row.agent === 'claude') &&
      (row.kind === 'chat' || row.kind === 'chat-unavailable')
  )
  if (!rows.length) {
    return (
      <DropdownMenuItem disabled>
        {t('trello.noAgents', 'No local Codex or Claude chat available')}
      </DropdownMenuItem>
    )
  }
  return rows.map((row) => (
    <DropdownMenuItem
      key={`${row.agent}:${row.executionHostId}`}
      disabled={busy || row.kind !== 'chat' || row.executionHostId !== LOCAL_EXECUTION_HOST_ID}
      onSelect={(event) => {
        event.preventDefault()
        if (launching.current || row.kind !== 'chat') {
          return
        }
        launching.current = true
        const focusIntent = captureNativeChatComposerFocusIntent()
        setBusy(true)
        void trelloRpc<{ run: TrelloRun; prompt: string }>('prepare', {
          cardId: card.id,
          worktreeId
        })
          .then(async ({ run, prompt }) => {
            const result = launchAgentInNewTab({
              requestId: newAgentLaunchRequestId(),
              focusIntent,
              agent: row.agent,
              worktreeId,
              requestedSurface: 'chat',
              selectedExecutionHostId: row.executionHostId,
              prompt,
              promptDelivery: 'auto-submit'
            })
            if (!result || 'refused' in result) {
              return
            }
            const settlement = await result.structuredSettlement
            if (settlement?.kind !== 'structured') {
              return
            }
            const tabId =
              result.surface.kind === 'local-chat'
                ? result.surface.tabId
                : structuredAgentSessionTabId(settlement.sessionId)
            await trelloRpc('bind', {
              runId: run.id,
              sessionId: settlement.sessionId,
              tabId,
              agent: row.agent
            })
            const groupId = `trello-${board.id.split('/').at(-1)}`
            const store = useAppStore.getState()
            store.editSidebarChatGroup(worktreeId, { kind: 'add', id: groupId, name: board.name })
            store.editSidebarChatGroup(worktreeId, {
              kind: 'move',
              chatId: structuredAgentSessionPaneKey(tabId, settlement.sessionId),
              groupId
            })
          })
          .catch((error) => toast.error(String(error)))
          .finally(() => {
            launching.current = false
            setBusy(false)
          })
      }}
    >
      <AgentIcon agent={row.agent} size={14} />
      {getAgentLabel(row.agent)}
    </DropdownMenuItem>
  ))
}

export function TrelloStartChat(props: Props) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button disabled={!props.board.workflow}>
          <MessageSquare className="size-4" />
          {t('trello.startChat', 'Work on this card')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {open ? <Choices {...props} /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
