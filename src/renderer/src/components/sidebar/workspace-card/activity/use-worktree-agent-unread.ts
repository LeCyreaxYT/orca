import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { selectAgentRowsUnread } from './worktree-card-agent-ack-inputs'

export function useWorktreeAgentUnread(agents: DashboardAgentRow[]): Record<string, boolean> {
  const unread = useAppStore(useShallow((state) => selectAgentRowsUnread(state, agents)))
  return useMemo(
    () => Object.fromEntries(agents.map((agent, index) => [agent.paneKey, unread[index] ?? false])),
    [agents, unread]
  )
}
