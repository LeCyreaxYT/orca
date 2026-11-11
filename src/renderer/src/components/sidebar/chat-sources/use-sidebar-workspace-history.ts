import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { useSidebarChatHistory } from './sidebar-chat-history-store'
import { mappedSidebarChatWorkspace } from '../../../../../shared/sidebar-chat-sources'
import { getStructuredAgentSessionTabs } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import { useSidebarChatWorkspaces } from './use-sidebar-chat-workspaces'
import { isAiVaultSessionResumableContent } from '../../../../../shared/ai-vault/contracts/ai-vault-types'

export function useSidebarWorkspaceHistory(workspaceId: string) {
  const history = useSidebarChatHistory((state) => state.sessions)
  const structure = useSidebarChatHistory((state) => state.structure)
  const mappings = useAppStore((state) => state.sidebarChatGroupsByWorktree)
  const unifiedTabs = useAppStore((state) => state.unifiedTabsByWorktree)
  const workspaces = useSidebarChatWorkspaces()
  return useMemo(() => {
    const openStructured = new Set(
      getStructuredAgentSessionTabs(unifiedTabs).map(
        (tab) => `${tab.executionHostId ?? 'local'}:${tab.entityId}`
      )
    )
    const represented = new Set<string>()
    for (const tab of Object.values(unifiedTabs).flat()) {
      if (tab.aiVaultTitle) {
        represented.add(
          `${tab.executionHostId ?? 'local'}:${tab.aiVaultTitle.agent}:${tab.aiVaultTitle.sessionId}`
        )
      }
    }
    return history
      .filter(
        (session) =>
          isAiVaultSessionResumableContent(session) &&
          !(
            session.structuredSession &&
            openStructured.has(`${session.executionHostId}:${session.structuredSession.sessionId}`)
          ) &&
          !represented.has(`${session.executionHostId}:${session.agent}:${session.sessionId}`) &&
          mappedSidebarChatWorkspace(session, mappings, structure, workspaces) === workspaceId
      )
      .map((session) => {
        const title =
          session.agent === 'codex' && session.executionHostId === 'local'
            ? structure.titles?.[session.sessionId]
            : undefined
        return title ? { ...session, title } : session
      })
  }, [workspaceId, history, structure, mappings, unifiedTabs, workspaces])
}
