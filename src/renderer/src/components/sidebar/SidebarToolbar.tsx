import React, { useState, useCallback } from 'react'
import { SidebarSettingsHelpMenu } from './SidebarSettingsHelpMenu'
import { SidebarProfileMenu } from './SidebarProfileMenu'
import { lazyWithRetry } from '@/lib/lazy-with-retry'

const SidebarUsage = lazyWithRetry(() => import('./SidebarUsage'))
const USAGE_EXPANDED_KEY = 'orca.sidebar.usage-expanded.v1'

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
  const [showUsage, setShowUsage] = useState(() => {
    try {
      return localStorage.getItem(USAGE_EXPANDED_KEY) !== 'false'
    } catch {
      return true
    }
  })
  const changeUsageVisibility = useCallback((show: boolean) => {
    setShowUsage(show)
    try {
      localStorage.setItem(USAGE_EXPANDED_KEY, String(show))
    } catch {
      // Keep the control usable when storage is unavailable.
    }
  }, [])
  return (
    <div className="mt-auto shrink-0">
      <React.Suspense fallback={<div className={showUsage ? 'h-40' : 'h-8'} />}>
        <SidebarUsage expanded={showUsage} onExpandedChange={changeUsageVisibility} />
      </React.Suspense>
      <div
        data-sidebar-profile-row
        className="flex items-center gap-1 border-t border-worktree-sidebar-border px-2 py-1 hover:bg-worktree-sidebar-accent"
      >
        <SidebarProfileMenu
          showUsage={showUsage}
          onShowUsageChange={changeUsageVisibility}
          workspaceBoardOpen={workspaceBoardOpen || workspaceBoardDragPreviewOpen}
          onWorkspaceBoardToggle={onWorkspaceBoardToggle}
        />
        <SidebarSettingsHelpMenu />
      </div>
    </div>
  )
})

export default SidebarToolbar
