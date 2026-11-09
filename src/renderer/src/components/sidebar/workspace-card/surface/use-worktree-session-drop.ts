import { useEffect, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import {
  AI_VAULT_SESSION_DRAG_END_EVENT,
  clearAiVaultSessionDragData,
  hasAiVaultSessionDragData,
  readAiVaultSessionDragData
} from '@/lib/agent-session/resume/history/ai-vault-session-drag'
import { activateAiVaultStructuredSession } from '@/lib/activate-ai-vault-structured-session'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { structuredAgentSessionTargetForHost } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { resolveAiVaultSessionResumeInChatForWorkspace } from '@/components/right-sidebar/ai-vault/session-actions/ai-vault-session-resume-in-chat-workspace'
import { resumeAiVaultSessionInNewChat } from '@/components/right-sidebar/ai-vault/session-actions/ai-vault-session-resume-in-chat-launch'

export function useWorktreeSessionDrop(workspaceId: string, enabled: boolean) {
  const t = useTranslate()
  const [hovering, setHovering] = useState(false)
  useEffect(() => {
    if (!hovering) {
      return
    }
    const clear = () => setHovering(false)
    window.addEventListener(AI_VAULT_SESSION_DRAG_END_EVENT, clear)
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener(AI_VAULT_SESSION_DRAG_END_EVENT, clear)
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [hovering])

  const accepts = (event: DragEvent<HTMLElement>) =>
    enabled && hasAiVaultSessionDragData(event.dataTransfer)

  return {
    hovering,
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!accepts(event)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer.dropEffect = 'copy'
      setHovering(true)
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (
        !(event.relatedTarget instanceof Node) ||
        !event.currentTarget.contains(event.relatedTarget)
      ) {
        setHovering(false)
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      if (!accepts(event)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      setHovering(false)
      const payload = readAiVaultSessionDragData(event.dataTransfer)
      clearAiVaultSessionDragData()
      window.dispatchEvent(new Event(AI_VAULT_SESSION_DRAG_END_EVENT))
      const session = payload?.nativeSession
      if (payload?.structuredSession) {
        const target = structuredAgentSessionTargetForHost(payload.sessionExecutionHostId)
        if (target) {
          void activateAiVaultStructuredSession(payload, undefined, target)
        }
        return
      }
      if (session && (session.agent === 'codex' || session.agent === 'claude')) {
        const state = useAppStore.getState()
        const eligibility = resolveAiVaultSessionResumeInChatForWorkspace({
          session,
          resumeState: { blocked: false, worktreeId: workspaceId, usesSessionWorktree: true },
          activeWorkspaceId: workspaceId,
          targetState: state,
          settings: state.settings
        })
        if (eligibility.available) {
          void resumeAiVaultSessionInNewChat(
            session,
            session.agent,
            workspaceId,
            newAgentLaunchRequestId()
          )
          return
        }
      }
      toast.error(
        t(
          'sidebar.sessionDropUnavailable',
          'This conversation cannot open here. Use its original workspace on the recording host.'
        )
      )
    }
  }
}
