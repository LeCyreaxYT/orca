import { useMemo } from 'react'
import { useAppStore } from '@/store'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'

export function useSidebarWorkspaceAgents(worktreeId: string, precomputed?: DashboardAgentRow[]) {
  const origins = useAppStore((state) => state.sidebarChatGroupsByWorktree[worktreeId]?.origins)
  const additionalOwners = useMemo(
    () => [...new Set(Object.values(origins ?? {}))].filter((id) => id !== worktreeId),
    [origins, worktreeId]
  )
  const selected = useWorktreeAgentRows(
    worktreeId,
    precomputed === undefined || additionalOwners.length > 0,
    additionalOwners
  )
  return additionalOwners.length > 0 ? selected : (precomputed ?? selected)
}
