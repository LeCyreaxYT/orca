import { useRef, useState } from 'react'
import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { fixtureState, tabs, resetSidebarFixture } from './sidebar-chat-groups-test-fixtures'
import { useAppStore } from '@/store'
import { useAllWorktrees } from '@/store/slices/worktrees/listing/use-worktree-catalog'
import { SidebarPinnedChats } from '../../chat-sources/SidebarPinnedChats'
import SidebarHeader from '../../SidebarHeader'
import SidebarNav from '../../SidebarNav'
import SidebarToolbar from '../../SidebarToolbar'
import { VirtualizedWorktreeViewport } from '../../worktree-list/viewport/VirtualizedWorktreeViewport'
import type { VirtualizedWorktreeViewportProps } from '../../worktree-list/viewport/viewport-props'
import type { VirtualizedScrollAnchor } from '@/hooks/useVirtualizedScrollAnchor'
import { structuredAgentSessionPaneKey } from '../../../../../../shared/agent-session/view/structured-agent-session-projection'

const nothing = () => {}
function ScrollNavigation() {
  const worktrees = useAllWorktrees()
  const repo = useAppStore((state) => state.repos[0])
  const scrollOffsetRef = useRef(0)
  const scrollAnchorRef = useRef<VirtualizedScrollAnchor>(null)
  const [generation, setGeneration] = useState(0)
  if (!repo) {
    return null
  }
  const props: VirtualizedWorktreeViewportProps = {
    beforeRows: (
      <>
        <SidebarPinnedChats />
        <SidebarHeader onWorkspaceBoardMenuOpenChange={nothing} />
      </>
    ),
    rows: worktrees.map((worktree) => ({
      type: 'item',
      worktree,
      repo,
      rowKey: worktree.id,
      sectionKey: 'all',
      depth: 0,
      groupDepth: 0,
      isLastLineageChild: true,
      lineageChildCount: 0
    })),
    activeWorktreeId: null,
    activeWorkspaceExecutionHostId: null,
    currentWorktreeId: null,
    groupBy: 'none',
    pinnedDisplayPolicy: 'single-location',
    projectOrderBy: 'manual',
    toggleGroup: nothing,
    collapsedGroups: new Set(),
    handleCreateForRepo: nothing,
    handleOpenRepoSettings: nothing,
    handleOpenWorktreeVisibility: nothing,
    handleShowImportedWorktrees: nothing,
    handleKeepImportedWorktreesHidden: nothing,
    importedWorktreeCardActionState: new Map(),
    handleOpenSuppressExternalWorktreeInbox: nothing,
    newExternalWorktreeInboxActionState: new Map(),
    handleRemoveProject: nothing,
    handleCreateGroupFromRepo: nothing,
    handleMoveProjectToGroup: nothing,
    handleRemoveProjectFromGroup: nothing,
    handleRenameProjectGroup: nothing,
    handleDeleteProjectGroup: nothing,
    handleCreateFolderWorkspace: nothing,
    activeModal: '',
    pendingRevealWorktree: null,
    pendingRevealSidebarRow: null,
    clearPendingRevealWorktreeId: nothing,
    clearPendingRevealSidebarRow: nothing,
    agentSendTargetWorktreeId: null,
    worktrees,
    folderWorkspaces: [],
    selectedWorktreeIds: new Set(),
    selectedWorktrees: [],
    onSelectionGesture: () => false,
    onImmediateWorktreeActivate: nothing,
    onContextMenuSelect: (_event, worktree) => [worktree],
    repoMap: new Map([[repo.id, repo]]),
    defaultHostId: 'local',
    worktreeMap: new Map(worktrees.map((worktree) => [worktree.id, worktree])),
    worktreeLineageById: {},
    workspaceLineageByChildKey: {},
    crossStoreChildrenByFolderId: new Map(),
    allRepoIds: [repo.id],
    onReorderHostSections: nothing,
    onHostDragActiveChange: nothing,
    prCache: null,
    hostedReviewCache: null,
    workspaceStatuses: [],
    onMoveWorktreeToStatus: nothing,
    onMoveWorktreesToStatus: nothing,
    onMoveWorktreesToStatusAtIndex: nothing,
    onPinWorktree: nothing,
    onPinWorktrees: nothing,
    onDropWorktreesOnWorkspaceBoard: nothing,
    workspaceBoardOpen: false,
    onWorkspaceBoardDragPreviewStart: nothing,
    onWorkspaceBoardDragPreviewCommit: nothing,
    onWorkspaceBoardDragPreviewCancel: nothing,
    shouldShowWorkspaceBoardDropIndicator: () => false,
    onReorderWorktrees: nothing,
    scrollOffsetRef,
    scrollAnchorRef
  }
  return (
    <div className="@container/sidebar flex h-[800px] flex-col bg-worktree-sidebar text-worktree-sidebar-foreground">
      <button
        hidden
        type="button"
        data-fixture-remount
        onClick={() => setGeneration((current) => current + 1)}
      />
      <SidebarNav />
      <VirtualizedWorktreeViewport key={generation} {...props} />
      <SidebarToolbar workspaceBoardOpen={false} onWorkspaceBoardToggle={nothing} />
    </div>
  )
}
const pinAssignments = Object.fromEntries(
  tabs
    .filter((_, index) => index !== 2 && index !== 3)
    .map((tab) => [structuredAgentSessionPaneKey(tab.id, tab.entityId), 'pinned'])
)
export const sharedScroll = defineFixture({
  width: 340,
  setup: async () => {
    resetSidebarFixture()
    await import('../../SidebarUsage')
  },
  store: {
    ...fixtureState,
    activeWorktreeId: 'chat-groups-fixture',
    persistedUIReady: true,
    setupGuideSidebarDismissed: true,
    sidebarChatGroupsByWorktree: {
      'chat-groups-fixture': { groups: [], assignments: pinAssignments, collapsed: [] }
    }
  },
  render: () => <ScrollNavigation />
})
