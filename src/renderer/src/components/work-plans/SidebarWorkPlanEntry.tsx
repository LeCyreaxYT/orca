import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { runtimeTargetForWorkspaceOwner } from '@/lib/workspace/ownership/resolve-owner'
import { NativeChatWorkPlanButton } from './NativeChatWorkPlanButton'

export function SidebarWorkPlanEntry() {
  const tab = useAppStore((state) =>
    state.activeWorktreeId ? state.getActiveTab(state.activeWorktreeId) : null
  )
  const environmentId = useAppStore((state) => {
    if (tab?.contentType !== 'agent-session') {
      return undefined
    }
    const target = runtimeTargetForWorkspaceOwner(state, {
      workspaceId: tab.worktreeId,
      hostId: tab.executionHostId
    })
    return !target ? undefined : target.kind === 'local' ? null : target.environmentId
  })
  const target = useMemo(
    () =>
      environmentId === undefined
        ? null
        : environmentId === null
          ? { kind: 'local' as const }
          : { kind: 'environment' as const, environmentId },
    [environmentId]
  )
  return tab?.contentType === 'agent-session' &&
    (tab.agentSessionAgent === 'codex' || tab.agentSessionAgent === 'claude') &&
    target ? (
    <NativeChatWorkPlanButton
      key={tab.entityId}
      sessionId={tab.entityId}
      target={target}
      labelled
    />
  ) : null
}
