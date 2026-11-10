import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { useSidebarChatHistory } from './sidebar-chat-history-store'
import type { AiVaultSession } from '../../../../../shared/ai-vault/contracts/ai-vault-types'
import type { SidebarChatSource } from '../../../../../shared/sidebar-chat-groups'
import { useSidebarChatSourceSetup } from './use-sidebar-chat-source-setup'
import { SIDEBAR_CHAT_HISTORY_REFRESH } from './SidebarChatSourceNotice'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../shared/non-secure-context-uuid'

/** One cached scan per recording host, shared by every workspace; opening history never launches an agent. */
export function SidebarChatHistorySync() {
  useSidebarChatSourceSetup()
  const sourcesKey = useAppStore((state) =>
    JSON.stringify(
      Object.values(state.sidebarChatGroupsByWorktree).flatMap((group) => group.sources ?? [])
    )
  )
  useEffect(() => {
    const sources: SidebarChatSource[] = JSON.parse(sourcesKey)
    if (!sources.length) {
      useSidebarChatHistory.setState({ sessions: [], loading: false, error: null })
      return
    }
    let disposed = false
    let pending = false
    let token: string | undefined
    const refresh = async () => {
      if (disposed || pending) {
        return
      }
      pending = true
      useSidebarChatHistory.setState({ loading: true })
      try {
        const structure = await window.api.aiVault.codexProjectStructure()
        const sessions: AiVaultSession[] = []
        for (const host of new Set(sources.map((source) => source.executionHostId))) {
          if (disposed) {
            return
          }
          token = `sidebar-history:${createBrowserUuid()}`
          const result = await window.api.aiVault.listSessions({
            executionHostScope: host,
            scopePaths: [
              ...new Set(
                sources
                  .filter((source) => source.executionHostId === host)
                  .map((source) => source.path)
              )
            ],
            unlimited: true,
            requestToken: token
          })
          if (result.cancelled) {
            return
          }
          sessions.push(
            ...result.sessions.filter(
              (session) => !session.subagent && ['codex', 'claude'].includes(session.agent)
            )
          )
        }
        if (!disposed) {
          useSidebarChatHistory.setState({ sessions, structure, error: null })
        }
      } catch (error) {
        if (!disposed) {
          useSidebarChatHistory.setState({ error: String(error) })
        }
      } finally {
        pending = false
        if (!disposed) {
          useSidebarChatHistory.setState({ loading: false })
        }
      }
    }
    void refresh()
    const refreshFromButton = () => void refresh()
    window.addEventListener(SIDEBAR_CHAT_HISTORY_REFRESH, refreshFromButton)
    const focus = window.api.aiVault.onWindowFocused(() => void refresh())
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh()
      }
    }, 30_000)
    return () => {
      disposed = true
      window.removeEventListener(SIDEBAR_CHAT_HISTORY_REFRESH, refreshFromButton)
      window.clearInterval(timer)
      focus()
      if (token) {
        void window.api.aiVault.cancelListSessions({ requestToken: token }).catch(console.error)
      }
    }
  }, [sourcesKey])
  return null
}
