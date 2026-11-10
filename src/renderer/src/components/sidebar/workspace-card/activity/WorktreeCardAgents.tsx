import { useWorktreeAgentSendTargets } from './use-worktree-agent-send-targets'
import { useWorktreeAgentActivation } from './use-worktree-agent-activation'
import { SidebarChatGroups } from './SidebarChatGroups'
import React, { useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '@/store'
import DashboardAgentRow from '@/components/dashboard/DashboardAgentRow'
import { useNow } from '@/hooks/use-now'
import { useWorktreeAgentRows } from './useWorktreeAgentRows'
import { useWorktreeAgentDisplay } from './use-worktree-agent-display'
import { cn } from '@/lib/utils'
import type { DashboardAgentRow as DashboardAgentRowData } from '@/components/dashboard/useDashboardData'
import { useFocusedAgentPaneKey } from './focused-agent-row-highlight'
import { CompactAgentExpansion, CompactAgentSummaryButton } from './worktree-card-compact-agents'
import { CompactAgentRow } from './worktree-card-compact-agent-row'
import { buildAgentRowLineageTree } from '@/components/dashboard/agent-row-lineage-model'
import {
  dispatchSuppressScrollAdjustment,
  useCompactAgentListReveal
} from './worktree-agent-list-reveal'
import { useWorktreeAgentExpansionState } from './worktree-card-agents-expansion-state'
import { useTranslate } from '@/i18n/use-translate'
import { useUiLanguageRevision } from '@/i18n/use-ui-language-revision'
import { activateRetainedAgentRow } from './activate-retained-agent-row'
import { useWorktreeAgentUnread } from './use-worktree-agent-unread'
import { opensClaudeParentConversation } from '@/lib/agent-session/navigation/claude-agent-row-view'
import { lineageAncestorPaneKeys } from './worktree-card-agent-lineage-disclosure'
import {
  ChildAgentsWithIdleGroup,
  buildCollapsedChildAgentSignalStates
} from './worktree-card-idle-child-agents'
import {
  EMPTY_SIDEBAR_CHAT_GROUPS,
  PINNED_CHAT_GROUP
} from '../../../../../../shared/sidebar-chat-groups'
import { sidebarChatGroup } from './sidebar-chat-group-model'
import { useSidebarChatHistory } from '../../chat-sources/sidebar-chat-history-store'

export { SUPPRESS_WORKTREE_LIST_SCROLL_ADJUSTMENT_EVENT } from './worktree-agent-list-reveal'
const stopBubble = (event: React.SyntheticEvent): void => event.stopPropagation()

type Props = {
  worktreeId: string
  agents?: DashboardAgentRowData[]
  className?: string
  pinnedOnly?: boolean
}

const WorktreeCardAgents = React.memo(function WorktreeCardAgents({
  worktreeId,
  agents: precomputedAgents,
  className,
  pinnedOnly = false
}: Props) {
  useUiLanguageRevision()
  const selectedAgents = useWorktreeAgentRows(worktreeId, precomputedAgents === undefined)
  const agents = precomputedAgents ?? selectedAgents
  if (agents.length === 0) {
    return (
      <SidebarChatGroups
        worktreeId={worktreeId}
        agents={agents}
        pinnedOnly={pinnedOnly}
        renderAgent={() => null}
      />
    )
  }
  // Only non-empty bodies mount the 30s clock, avoiding timer cost for idle worktrees.
  return (
    <WorktreeCardAgentsBody
      worktreeId={worktreeId}
      agents={agents}
      className={className}
      pinnedOnly={pinnedOnly}
    />
  )
})

type BodyProps = Omit<Props, 'agents'> & {
  agents: DashboardAgentRowData[]
}

const WorktreeCardAgentsBody = React.memo(function WorktreeCardAgentsBody({
  worktreeId,
  agents,
  className,
  pinnedOnly = false
}: BodyProps) {
  const t = useTranslate()
  const { agentActivityDisplayMode, showAgentModels } = useWorktreeAgentDisplay()
  const dropAgentStatus = useAppStore((s) => s.dropAgentStatus)
  const dismissRetainedAgent = useAppStore((s) => s.dismissRetainedAgent)
  const { isAgentSendTargetModeActive, handleSendTargetClick, sendTargetFor } =
    useWorktreeAgentSendTargets(worktreeId)
  const focusedAgentPaneKey = useFocusedAgentPaneKey(worktreeId)
  const compactAgentListRootRef = useRef<HTMLDivElement | null>(null)

  const unvisitedByPaneKey = useWorktreeAgentUnread(agents)

  const handleDismissAgent = useCallback(
    (paneKey: string) => {
      dropAgentStatus(paneKey)
      dismissRetainedAgent(paneKey)
    },
    [dropAgentStatus, dismissRetainedAgent]
  )

  const handleActivateAgentTab = useWorktreeAgentActivation(worktreeId)
  const handleActivateRetainedAgent = useCallback(
    (tabId: string, paneKey: string) => activateRetainedAgentRow(worktreeId, tabId, paneKey),
    [worktreeId]
  )

  const now = useNow(30_000)
  const lineageTree = useMemo(() => buildAgentRowLineageTree(agents), [agents])
  const { rootRows: allRootAgents, childrenByParentPaneKey } = lineageTree
  const chatGroups = useAppStore(
    (state) => state.sidebarChatGroupsByWorktree[worktreeId] ?? EMPTY_SIDEBAR_CHAT_GROUPS
  )
  const providerPins = useSidebarChatHistory((state) => state.structure.pinned)
  const rootAgents = useMemo(
    () =>
      agentActivityDisplayMode === 'compact' && !pinnedOnly
        ? allRootAgents.filter(
            (agent) => sidebarChatGroup(agent, chatGroups, providerPins) !== PINNED_CHAT_GROUP
          )
        : allRootAgents,
    [allRootAgents, chatGroups, providerPins, agentActivityDisplayMode, pinnedOnly]
  )
  const hasLineage = childrenByParentPaneKey.size > 0
  const collapsedChildAgentSignalStates = useMemo(
    () => buildCollapsedChildAgentSignalStates(childrenByParentPaneKey),
    [childrenByParentPaneKey]
  )
  // Persist disclosure outside component state so virtualizer/sibling-triggered remounts cannot reset it.
  const {
    expandedLineageParents,
    expandedIdleChildGroups,
    compactRootListExpanded,
    toggleLineageParent: toggleLineageParentState,
    toggleIdleChildGroup: toggleIdleChildGroupState,
    toggleCompactRootList
  } = useWorktreeAgentExpansionState(worktreeId)

  useCompactAgentListReveal(
    compactRootListExpanded,
    agentActivityDisplayMode,
    compactAgentListRootRef
  )
  const toggleLineageParent = useCallback(
    (paneKey: string) => {
      dispatchSuppressScrollAdjustment()
      toggleLineageParentState(paneKey)
    },
    [toggleLineageParentState]
  )
  const toggleIdleChildGroup = useCallback(
    (parentPaneKey: string) => {
      dispatchSuppressScrollAdjustment()
      toggleIdleChildGroupState(parentPaneKey)
    },
    [toggleIdleChildGroupState]
  )

  // Picker rows are the send targets, so every lineage level stays open while picking.
  const isLineageExpanded = (paneKey: string): boolean =>
    isAgentSendTargetModeActive || expandedLineageParents.has(paneKey)
  const focusedAncestorPaneKeys = useMemo(
    () => lineageAncestorPaneKeys(childrenByParentPaneKey, focusedAgentPaneKey),
    [childrenByParentPaneKey, focusedAgentPaneKey]
  )
  // A collapsed parent stands in for its hidden focused descendant.
  const isFocusedOrHidesFocus = (paneKey: string, expanded: boolean): boolean =>
    paneKey === focusedAgentPaneKey || (!expanded && focusedAncestorPaneKeys.has(paneKey))

  const renderChildAgents = (
    parent: DashboardAgentRowData,
    childAgents: DashboardAgentRowData[],
    renderChild: (childAgent: DashboardAgentRowData, idleGroupExpanded: boolean) => React.ReactNode
  ): React.ReactNode => (
    <ChildAgentsWithIdleGroup
      childAgents={childAgents}
      // Picking shows every child flat; folding would hide send targets.
      flat={isAgentSendTargetModeActive}
      idleExpanded={expandedIdleChildGroups.has(parent.paneKey)}
      onToggleIdle={() => toggleIdleChildGroup(parent.paneKey)}
      layout={agentActivityDisplayMode === 'compact' ? 'compact' : 'full'}
      ariaLevel={(parent.lineage?.depth ?? 0) + 2}
      renderChild={renderChild}
    />
  )

  const renderAgentBranch = (
    agent: DashboardAgentRowData,
    ancestorPaneKeys: ReadonlySet<string> = new Set()
  ): React.ReactNode => {
    if (ancestorPaneKeys.has(agent.paneKey)) {
      // External lineage metadata may cycle; reject repeated ancestors before recursion.
      return null
    }
    const childAgents = childrenByParentPaneKey.get(agent.paneKey) ?? []
    const hasChildAgents = childAgents.length > 0
    const expanded = isLineageExpanded(agent.paneKey)
    // Picker mode forces children open; a toggle there would silently flip stored state.
    const canToggle = hasChildAgents && !isAgentSendTargetModeActive
    const sendTarget = sendTargetFor(agent.paneKey)
    const descendantAncestorPaneKeys = new Set(ancestorPaneKeys)
    descendantAncestorPaneKeys.add(agent.paneKey)
    return (
      <React.Fragment key={agent.paneKey}>
        <DashboardAgentRow
          agent={agent}
          showModel={showAgentModels}
          onDismiss={handleDismissAgent}
          onActivate={
            agent.rowSource === 'retained' ? handleActivateRetainedAgent : handleActivateAgentTab
          }
          now={now}
          // Keep rows bold until visiting the tab auto-acknowledges attention.
          isUnvisited={unvisitedByPaneKey[agent.paneKey] ?? false}
          // Use the smaller dot so dense inline rows do not read it as a second identity icon.
          stateDotSize="sm"
          // Row clicks already navigate to the agent, so a second expand glyph is redundant.
          hideExpand
          childAgentCount={hasChildAgents ? childAgents.length : undefined}
          childAgentsExpanded={expanded}
          collapsedChildAgentsState={
            hasChildAgents && !expanded
              ? collapsedChildAgentSignalStates.get(agent.paneKey)
              : undefined
          }
          onToggleChildAgents={canToggle ? () => toggleLineageParent(agent.paneKey) : undefined}
          isFocusedPane={isFocusedOrHidesFocus(agent.paneKey, expanded)}
          sendTargetStatus={sendTarget?.status}
          sendTargetDisabledReason={sendTarget?.disabledReason}
          onSendTargetClick={isAgentSendTargetModeActive ? handleSendTargetClick : undefined}
          // Chevron/indent already show hierarchy; fixed-offset connectors misalign into floating fragments.
          hideLineageConnectors
        />
        {hasChildAgents && expanded ? (
          <div className="worktree-agent-lineage-children">
            {renderChildAgents(agent, childAgents, (childAgent) =>
              renderAgentBranch(childAgent, descendantAncestorPaneKeys)
            )}
          </div>
        ) : null}
      </React.Fragment>
    )
  }

  const renderCompactAgentBranch = (
    agent: DashboardAgentRowData,
    ancestorPaneKeys: ReadonlySet<string> = new Set(),
    cacheTimerActive = true
  ): React.ReactNode => {
    if (ancestorPaneKeys.has(agent.paneKey)) {
      return null
    }
    const childAgents = childrenByParentPaneKey.get(agent.paneKey) ?? []
    const hasChildAgents = childAgents.length > 0
    const expanded = isLineageExpanded(agent.paneKey)
    // Picker mode forces children open; a toggle there would silently flip stored state.
    const canToggle = hasChildAgents && !isAgentSendTargetModeActive
    const sendTarget = sendTargetFor(agent.paneKey)
    const descendantAncestorPaneKeys = new Set(ancestorPaneKeys)
    descendantAncestorPaneKeys.add(agent.paneKey)
    return (
      <div key={agent.paneKey} className="min-w-0">
        <CompactAgentRow
          agent={agent}
          titleOnly={pinnedOnly || agentActivityDisplayMode === 'full'}
          showModel={showAgentModels}
          now={now}
          parentConversationDescription={
            opensClaudeParentConversation(agent)
              ? t('auto.lib.claudeAgentRowView.openParentConversation', 'Open parent conversation')
              : undefined
          }
          isUnvisited={unvisitedByPaneKey[agent.paneKey] ?? false}
          onActivate={
            agent.rowSource === 'retained' ? handleActivateRetainedAgent : handleActivateAgentTab
          }
          sendTargetStatus={sendTarget?.status}
          sendTargetDisabledReason={sendTarget?.disabledReason}
          onSendTargetClick={isAgentSendTargetModeActive ? handleSendTargetClick : undefined}
          childAgentCount={hasChildAgents ? childAgents.length : undefined}
          childAgentsExpanded={expanded}
          collapsedChildAgentsState={
            hasChildAgents && !expanded
              ? collapsedChildAgentSignalStates.get(agent.paneKey)
              : undefined
          }
          onToggleChildAgents={canToggle ? () => toggleLineageParent(agent.paneKey) : undefined}
          isFocusedPane={isFocusedOrHidesFocus(agent.paneKey, expanded)}
          cacheTimerActive={cacheTimerActive}
        />
        {hasChildAgents ? (
          <CompactAgentExpansion expanded={expanded}>
            <div className="worktree-agent-lineage-children flex flex-col gap-0.5">
              {renderChildAgents(agent, childAgents, (childAgent, idleGroupExpanded) =>
                renderCompactAgentBranch(
                  childAgent,
                  descendantAncestorPaneKeys,
                  cacheTimerActive && expanded && idleGroupExpanded
                )
              )}
            </div>
          </CompactAgentExpansion>
        ) : null}
      </div>
    )
  }

  if (agentActivityDisplayMode === 'compact' && !pinnedOnly) {
    const summaryAgents = rootAgents
    // Collapse compact multi-agent lists except when their rows are the send-target picker.
    const shouldUseSummaryRow = summaryAgents.length > 1 && !isAgentSendTargetModeActive
    const subjectLabel = t('sidebar.agentSummary.agentCount', '{{count}} agents', {
      count: rootAgents.length,
      defaultValue_one: '{{count}} agent'
    })

    return (
      <div
        ref={compactAgentListRootRef}
        className={cn('flex flex-col mt-1 gap-0.5', className)}
        onClick={stopBubble}
        onDoubleClick={stopBubble}
        onMouseDown={stopBubble}
        onPointerDown={stopBubble}
        role={hasLineage ? 'tree' : 'group'}
        aria-label={t('auto.components.sidebar.WorktreeCardAgents.1b0a156717', 'Agents')}
        data-compact-agent-list="true"
      >
        {agents.length === 0 ? null : shouldUseSummaryRow ? (
          <div
            className={cn(
              'compact-agent-summary-panel',
              compactRootListExpanded && 'compact-agent-summary-panel-expanded'
            )}
          >
            <CompactAgentSummaryButton
              agents={summaryAgents}
              subjectLabel={subjectLabel}
              expanded={compactRootListExpanded}
              onToggle={() => {
                dispatchSuppressScrollAdjustment()
                toggleCompactRootList()
              }}
            />
            <CompactAgentExpansion expanded={compactRootListExpanded}>
              {rootAgents.map((rootAgent) =>
                renderCompactAgentBranch(rootAgent, new Set(), compactRootListExpanded)
              )}
            </CompactAgentExpansion>
          </div>
        ) : (
          rootAgents.map((rootAgent) => renderCompactAgentBranch(rootAgent))
        )}
      </div>
    )
  }

  return (
    // Gutter clicks must not bubble into card activation or metadata editing.
    <div
      className={cn('flex flex-col mt-1', className)}
      onClick={stopBubble}
      onDoubleClick={stopBubble}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
      role={hasLineage ? 'tree' : 'group'}
      aria-label={t('auto.components.sidebar.WorktreeCardAgents.1b0a156717', 'Agents')}
    >
      {isAgentSendTargetModeActive && !pinnedOnly ? (
        rootAgents.map((rootAgent) => renderAgentBranch(rootAgent))
      ) : (
        <SidebarChatGroups
          worktreeId={worktreeId}
          pinnedOnly={pinnedOnly}
          agents={rootAgents}
          renderAgent={renderCompactAgentBranch}
          focused={
            new Set([
              ...(focusedAgentPaneKey ? [focusedAgentPaneKey] : []),
              ...focusedAncestorPaneKeys
            ])
          }
          childSignals={collapsedChildAgentSignalStates}
        />
      )}
    </div>
  )
})

export default WorktreeCardAgents
