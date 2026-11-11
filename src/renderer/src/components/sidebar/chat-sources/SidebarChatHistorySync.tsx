import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'
import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { publishSidebarChatHistory, useSidebarChatHistory } from './sidebar-chat-history-store'
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
  useEffect(() => installSidebarChatHistorySync(sourcesKey), [sourcesKey])
  return null
}

function installSidebarChatHistorySync(sourcesKey: string) {
  const sources: SidebarChatSource[] = JSON.parse(sourcesKey)
  if (!sources.length) {
    publishSidebarChatHistory([])
    useSidebarChatHistory.setState({ loading: false })
    return
  }
  let disposed = false
  let pending = false
  let token: string | undefined
  let restoreCached = useSidebarChatHistory.getState().sessions.length === 0
  const refresh = async () => {
    if (disposed || pending) {
      return
    }
    pending = true
    useSidebarChatHistory.setState({ loading: true })
    try {
      const structure = await window.api.aiVault.codexProjectStructure()
      if (restoreCached && sources.some((source) => source.executionHostId === 'local')) {
        restoreCached = false
        token = `sidebar-history:${createBrowserUuid()}`
        const cached = await window.api.aiVault
          .listSessions({
            executionHostScope: 'local',
            cachedOnly: true,
            unlimited: true,
            requestToken: token
          })
          .catch(() => null)
        if (disposed) {
          return
        }
        if (cached && !cached.cancelled && cached.sessions.length > 0) {
          publishSidebarChatHistory(sidebarSessions(cached.sessions), structure)
        }
      }
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
          metadataOnly: true,
          requestToken: token
        })
        if (result.cancelled) {
          return
        }
        sessions.push(...sidebarSessions(result.sessions))
      }
      if (!disposed) {
        publishSidebarChatHistory(sessions, structure)
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
  const refreshFromButton = () => void refresh()
  window.addEventListener(SIDEBAR_CHAT_HISTORY_REFRESH, refreshFromButton)
  const focus = window.api.aiVault.onWindowFocused(() => void refresh())
  const stopTimer = installWindowVisibilityInterval({
    run: refreshFromButton,
    intervalMs: 30_000,
    slowWhileUnfocused: true,
    jitterOnVisible: true
  })
  return () => {
    disposed = true
    window.removeEventListener(SIDEBAR_CHAT_HISTORY_REFRESH, refreshFromButton)
    stopTimer()
    focus()
    if (token) {
      void window.api.aiVault.cancelListSessions({ requestToken: token }).catch(console.error)
    }
  }
}

function sidebarSessions(sessions: readonly AiVaultSession[]): AiVaultSession[] {
  return sessions.filter(
    (session) => !session.subagent && ['codex', 'claude'].includes(session.agent)
  )
}
