import { useAppStateView } from '@/store/retained-views/app-state-view'
import { getStructuredAgentSessionTabsByPaneKey } from '@/components/native-chat/session/status/structured-agent-session-tabs'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { applyAgentRowLineage } from '@/components/dashboard/agent-row-lineage'
import { migrationUnsupportedToAgentStatusEntry } from '../../../../../../shared/migration-unsupported-agent-entry'
import type { AppState } from '@/store/types'
import {
  EMPTY_LIVE_PTY_IDS,
  EMPTY_PANE_FOREGROUND_AGENTS,
  EMPTY_RUNTIME_PANE_TITLES,
  selectLivePtyIdsForWorktree,
  selectPaneForegroundAgentsForWorktree,
  selectRuntimePaneTitlesForWorktree
} from './worktree-card-status-inputs'
import { buildWorktreeAgentRows } from './worktree-agent-rows'
import {
  EMPTY_LIVE_ENTRIES,
  EMPTY_MIGRATION_UNSUPPORTED_ENTRIES,
  EMPTY_RETAINED,
  EMPTY_TERMINAL_LAYOUTS,
  selectLiveAgentStatusEntriesForWorktree,
  selectMigrationUnsupportedEntriesForWorktree,
  selectRetainedAgentEntriesForWorktree,
  selectTerminalLayoutsForWorktree
} from './worktree-agent-row-selectors'
import {
  selectWorktreeAgentOrchestration as selectRuntimeAgentOrchestrationForWorktree,
  EMPTY_WORKTREE_AGENT_ORCHESTRATION
} from './worktree-agent-orchestration-index'

import { EMPTY_TABS } from './worktree-card-empty-inputs'
import {
  createWorktreeAgentFreshnessSelector,
  EMPTY_WORKTREE_AGENT_FRESHNESS_SIGNATURE
} from './worktree-agent-freshness-selector'

// Why frozen: shared by every inactive card, and callers only read these rows.
const EMPTY_AGENT_ROWS = Object.freeze([]) as unknown as DashboardAgentRow[]
const NO_ADDITIONAL_WORKTREES: readonly string[] = []
const subscribeToNothing = (): (() => void) => () => {}

/** Share indexed worktree inputs across cards; derive live/retained row freshness from the available evidence. */
export function useWorktreeAgentRows(
  worktreeId: string,
  active = true,
  additionalWorktreeIds: readonly string[] = NO_ADDITIONAL_WORKTREES
): DashboardAgentRow[] {
  const store = useAppStateView()
  const selectInputs = useMemo(
    () => createWorktreeAgentInputsForOwners([worktreeId, ...additionalWorktreeIds], active),
    [worktreeId, additionalWorktreeIds, active]
  )
  const getInputs = useCallback(() => selectInputs(store.getState()), [selectInputs, store])
  const inputs = useSyncExternalStore(
    active ? store.subscribe : subscribeToNothing,
    getInputs,
    getInputs
  )

  return useMemo(
    () =>
      active
        ? buildCurrentWorktreeAgentRows(
            inputs,
            getStructuredAgentSessionTabsByPaneKey(store.getState().unifiedTabsByWorktree)
          )
        : EMPTY_AGENT_ROWS,
    [active, store, inputs]
  )
}

function createWorktreeAgentInputsForOwners(ownerIds: readonly string[], active: boolean) {
  const selectors = [...new Set(ownerIds)].map((ownerId) =>
    createWorktreeAgentInputsSelector(ownerId, active)
  )
  let previous: WorktreeAgentInputs[] | undefined
  return (state: AppState) => {
    const next = selectors.map((select) => select(state))
    if (previous && next.every((value, index) => value === previous?.[index])) {
      return previous
    }
    previous = next
    return next
  }
}

function createWorktreeAgentInputsSelector(ownerId: string, active: boolean) {
  const selectAgentFreshness = createWorktreeAgentFreshnessSelector(ownerId)
  let previous: ReturnType<typeof readInputs> | undefined
  const readInputs = (state: AppState) =>
    [
      active ? state.tabsByWorktree[ownerId] : EMPTY_TABS,
      active ? selectLiveAgentStatusEntriesForWorktree(state, ownerId) : EMPTY_LIVE_ENTRIES,
      active
        ? selectMigrationUnsupportedEntriesForWorktree(state, ownerId)
        : EMPTY_MIGRATION_UNSUPPORTED_ENTRIES,
      active ? selectRetainedAgentEntriesForWorktree(state, ownerId) : EMPTY_RETAINED,
      active ? selectRuntimePaneTitlesForWorktree(state, ownerId) : EMPTY_RUNTIME_PANE_TITLES,
      active ? selectLivePtyIdsForWorktree(state, ownerId) : EMPTY_LIVE_PTY_IDS,
      active ? selectTerminalLayoutsForWorktree(state, ownerId) : EMPTY_TERMINAL_LAYOUTS,
      active
        ? selectRuntimeAgentOrchestrationForWorktree(state, ownerId)
        : EMPTY_WORKTREE_AGENT_ORCHESTRATION,
      active ? selectPaneForegroundAgentsForWorktree(state, ownerId) : EMPTY_PANE_FOREGROUND_AGENTS,
      active ? selectAgentFreshness(state) : EMPTY_WORKTREE_AGENT_FRESHNESS_SIGNATURE
    ] as const
  return (state: AppState) => {
    if (!active && previous) {
      return previous
    }
    const next = readInputs(state)
    // The indexed selectors preserve equal records; compare references without allocating shallow-comparison maps.
    if (previous && next.every((value, index) => Object.is(value, previous?.[index]))) {
      return previous
    }
    previous = next
    return next
  }
}

type WorktreeAgentInputs = ReturnType<ReturnType<typeof createWorktreeAgentInputsSelector>>

function buildCurrentWorktreeAgentRows(
  inputs: readonly WorktreeAgentInputs[],
  representedTabs: ReturnType<typeof getStructuredAgentSessionTabsByPaneKey>
): DashboardAgentRow[] {
  const now = Date.now()
  return inputs.flatMap(
    ([
      tabs,
      liveEntries,
      migrationUnsupported,
      retained,
      runtimePaneTitlesByTabId,
      ptyIdsByTabId,
      terminalLayoutsByTabId,
      runtimeAgentOrchestrationByPaneKey,
      paneForegroundAgentByPaneKey
      // The final input invalidates this memo when freshness expires.
    ]) => {
      const entries =
        migrationUnsupported.length > 0
          ? [
              ...liveEntries,
              ...migrationUnsupported.flatMap((unsupported) => {
                const entry = migrationUnsupportedToAgentStatusEntry(unsupported)
                return entry ? [entry] : []
              })
            ]
          : liveEntries
      return applyAgentRowLineage(
        buildWorktreeAgentRows({
          tabs: tabs ?? EMPTY_TABS,
          representedTabs,
          entries,
          retained,
          runtimePaneTitlesByTabId,
          ptyIdsByTabId,
          terminalLayoutsByTabId,
          runtimeAgentOrchestrationByPaneKey,
          paneForegroundAgentByPaneKey,
          now
        })
      )
    }
  )
}
