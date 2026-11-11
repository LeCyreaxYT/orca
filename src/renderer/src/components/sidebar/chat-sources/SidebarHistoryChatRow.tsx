import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { AgentTypeIcon } from '@/components/agent/icons/agent-type-icon'
import type { AiVaultSession } from '../../../../../shared/ai-vault/contracts/ai-vault-types'
import { sidebarHistoryChatId } from '../../../../../shared/sidebar-chat-sources'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { activateAiVaultStructuredSession } from '@/lib/activate-ai-vault-structured-session'
import { structuredAgentSessionTargetForHost } from '@/runtime/native-chat/session-ownership/structured-agent-session-owner'
import { resolveAiVaultSessionResumeInChatForWorkspace } from '@/components/right-sidebar/ai-vault/session-actions/ai-vault-session-resume-in-chat-workspace'
import { resumeAiVaultSessionInNewChat } from '@/components/right-sidebar/ai-vault/session-actions/ai-vault-session-resume-in-chat-launch'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'

export function SidebarHistoryChatRow({
  session,
  worktreeId
}: {
  session: AiVaultSession
  worktreeId: string
}) {
  const t = useTranslate()
  const [opening, setOpening] = useState(false)
  const open = () => {
    if (opening) {
      return
    }
    setOpening(true)
    void openSidebarHistoryChat({
      session,
      worktreeId,
      setOpening,
      unavailableMessage: t(
        'sidebar.sessionDropUnavailable',
        'This conversation cannot open here. Use its original workspace on the recording host.'
      ),
      failedMessage: t('sidebar.chatSources.openFailed', 'Could not open this chat. Try again.')
    })
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-busy={opening}
      data-sidebar-chat-row={sidebarHistoryChatId(session)}
      className="flex h-8 min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 text-[13px] text-worktree-sidebar-foreground hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={session.title}
      onClick={() => void open()}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          void open()
        }
      }}
    >
      {opening ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <AgentTypeIcon agentType={session.agent} size={14} />
      )}
      <span className="min-w-0 flex-1 truncate">{session.title}</span>
    </div>
  )
}

async function openSidebarHistoryChat({
  session,
  worktreeId,
  setOpening,
  unavailableMessage,
  failedMessage
}: {
  session: AiVaultSession
  worktreeId: string
  setOpening: (opening: boolean) => void
  unavailableMessage: string
  failedMessage: string
}) {
  try {
    if (session.structuredSession) {
      const target = structuredAgentSessionTargetForHost(session.executionHostId)
      if (target) {
        await activateAiVaultStructuredSession(session, undefined, target)
        return
      }
    }
    const state = useAppStore.getState()
    const origin =
      state.sidebarChatGroupsByWorktree[worktreeId]?.origins?.[sidebarHistoryChatId(session)]
    const resumeWorktreeId = origin ?? worktreeId
    const eligibility = resolveAiVaultSessionResumeInChatForWorkspace({
      session,
      resumeState: { blocked: false, worktreeId: resumeWorktreeId, usesSessionWorktree: true },
      activeWorkspaceId: resumeWorktreeId,
      targetState: state,
      settings: state.settings
    })
    if (eligibility.available && (session.agent === 'codex' || session.agent === 'claude')) {
      await resumeAiVaultSessionInNewChat(
        session,
        session.agent,
        resumeWorktreeId,
        newAgentLaunchRequestId()
      )
    } else {
      toast.error(unavailableMessage)
    }
  } catch {
    toast.error(failedMessage)
  } finally {
    setOpening(false)
  }
}
