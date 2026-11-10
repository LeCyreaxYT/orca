import { useCallback, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { deriveRunningAgentSendTargets } from '@/lib/agent-session/messaging/running-agent-targets'
import {
  selectSendTargetControlInputs,
  selectSendTargetInputs
} from './worktree-card-send-target-inputs'
import { agentSendDisabledReasonLabel } from '@/lib/agent-session/messaging/agent-send-disabled-reason-label'
import { useUiLanguageRevision } from '@/i18n/use-ui-language-revision'
import { useTranslate } from '@/i18n/use-translate'
import { recomputeOn } from '@/lib/recompute-on'

export function useWorktreeAgentSendTargets(worktreeId: string) {
  const t = useTranslate()
  const languageRevision = useUiLanguageRevision()
  const { targetMode: agentSendPopoverTargetMode, agentStatusEpoch } = useAppStore(
    useShallow((s) => selectSendTargetControlInputs(s, worktreeId))
  )
  const sendTargetInputs = useAppStore(useShallow((s) => selectSendTargetInputs(s, worktreeId)))
  const sendPromptToSidebarAgentTarget = useAppStore((s) => s.sendPromptToSidebarAgentTarget)
  const isAgentSendTargetModeActive = agentSendPopoverTargetMode !== null
  const sendTargetsByPaneKey = useMemo(
    () =>
      recomputeOn([agentStatusEpoch, languageRevision], () => {
        if (!isAgentSendTargetModeActive) {
          return new Map<
            string,
            { status: 'eligible' | 'disabled' | 'sending'; disabledReason?: string }
          >()
        }

        return new Map(
          deriveRunningAgentSendTargets(sendTargetInputs, worktreeId).map((target) => [
            target.paneKey,
            agentSendPopoverTargetMode?.status === 'sending' &&
            agentSendPopoverTargetMode.sendingPaneKey === target.paneKey
              ? {
                  status: 'sending' as const,
                  disabledReason: t(
                    'auto.components.sidebar.WorktreeCardAgents.sendingTarget',
                    'Sending...'
                  )
                }
              : target.disabledReason
                ? {
                    status: target.status,
                    disabledReason: agentSendDisabledReasonLabel(target.disabledReason)
                  }
                : { status: target.status }
          ])
        )
      }),
    [
      // Freshness timers advance this epoch without replacing the status map.
      agentStatusEpoch,
      languageRevision,
      agentSendPopoverTargetMode,
      isAgentSendTargetModeActive,
      sendTargetInputs,
      worktreeId,
      t
    ]
  )

  const handleSendTargetClick = useCallback(
    (paneKey: string) => {
      void sendPromptToSidebarAgentTarget(paneKey)
    },
    [sendPromptToSidebarAgentTarget]
  )

  const sendTargetFor = (paneKey: string) =>
    isAgentSendTargetModeActive
      ? (sendTargetsByPaneKey.get(paneKey) ?? {
          status: 'disabled' as const,
          disabledReason: t(
            'auto.components.sidebar.WorktreeCardAgents.agentUnavailable',
            'Agent is not available'
          )
        })
      : undefined
  return { isAgentSendTargetModeActive, handleSendTargetClick, sendTargetFor }
}
