import React, { useState } from 'react'
import { SidebarSettingsHelpMenu } from './SidebarSettingsHelpMenu'
import { SidebarProfileMenu } from './SidebarProfileMenu'
import { lazyWithRetry } from '@/lib/lazy-with-retry'

const SidebarUsage = lazyWithRetry(() => import('./SidebarUsage'))

type SidebarToolbarProps = {
  workspaceBoardOpen: boolean
  workspaceBoardDragPreviewOpen?: boolean
  onWorkspaceBoardToggle: () => void
}

const SidebarToolbar = React.memo(function SidebarToolbar({
  workspaceBoardOpen,
  workspaceBoardDragPreviewOpen = false,
  onWorkspaceBoardToggle
}: SidebarToolbarProps) {
  const [showUsage, setShowUsage] = useState(true)
  return (
    <div className="mt-auto shrink-0">
      {showUsage ? (
        <React.Suspense fallback={<div className="h-40" />}>
          <SidebarUsage />
        </React.Suspense>
      ) : null}
      <div className="flex items-center gap-1 border-t border-worktree-sidebar-border px-2 py-1">
        <SidebarProfileMenu
          showUsage={showUsage}
          onShowUsageChange={setShowUsage}
          workspaceBoardOpen={workspaceBoardOpen || workspaceBoardDragPreviewOpen}
          onWorkspaceBoardToggle={onWorkspaceBoardToggle}
        />
        <SidebarSettingsHelpMenu />
      </div>
    </div>
  )
})

export default SidebarToolbar
