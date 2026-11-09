import { useCallback, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import { useStructuredAgentSessionHostCapabilityState } from '@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import { STRUCTURED_AGENT_SESSION_REFRESH_HISTORY_RUNTIME_CAPABILITY } from '../../../../../../shared/agent-session/structured-agent-session-surface-capabilities'
import type { RuntimeClientTarget } from '../../../../../../shared/runtime-client-target'
import { getStructuredAgentSessionReadOwner } from '../../session/structured/read/structured-agent-session-read-owner'

async function reloadHistory(
  reload: () => Promise<unknown>,
  setRefreshing: (refreshing: boolean) => void,
  fallback: string
): Promise<void> {
  setRefreshing(true)
  try {
    await reload()
  } catch (error) {
    toast.error(error instanceof Error ? error.message : fallback)
  } finally {
    setRefreshing(false)
  }
}

export function ReloadConversationButton({ reload }: { reload: () => Promise<unknown> }) {
  const t = useTranslate()
  const [refreshing, setRefreshing] = useState(false)
  const label = t('components.native-chat.reloadHistory', 'Reload conversation history')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="pane-title"
          size="icon-xs"
          aria-label={label}
          disabled={refreshing}
          onClick={(event) => {
            event.stopPropagation()
            if (!refreshing) {
              void reloadHistory(reload, setRefreshing, label)
            }
          }}
        >
          <RefreshCw className={refreshing ? 'size-3 animate-spin' : 'size-3'} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function NativeChatHistoryRefreshButton({
  sessionId,
  agent,
  target
}: {
  sessionId: string
  agent?: string
  target?: RuntimeClientTarget
}) {
  const capability = useStructuredAgentSessionHostCapabilityState(
    target ?? null,
    STRUCTURED_AGENT_SESSION_REFRESH_HISTORY_RUNTIME_CAPABILITY
  )
  const owner = useMemo(
    () => (target ? getStructuredAgentSessionReadOwner(sessionId, target) : null),
    [sessionId, target]
  )
  const reload = useCallback(async () => {
    if (!target || !owner) {
      return
    }
    await callStructuredAgentSession(target, 'agentSession.refreshHistory', { sessionId })
    owner.resync?.()
  }, [owner, sessionId, target])
  return capability === 'supported' && (agent === 'codex' || agent === 'claude') ? (
    <ReloadConversationButton reload={reload} />
  ) : null
}
