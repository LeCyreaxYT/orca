import { useCallback, useMemo } from 'react'
import { useAppStore } from '@/store'
import {
  areAllProjectsCollapsed,
  getRenderedProjectCollapseKeys,
  setAllProjectsCollapsed
} from './project-collapse-all'
import type { WorktreeGroupBy } from '../../../../../../shared/sidebar-list/row-types'

export function useProjectsCollapseControl(
  groupBy: WorktreeGroupBy,
  rows: Parameters<typeof getRenderedProjectCollapseKeys>[0],
  collapsedGroups: ReadonlySet<string>
) {
  const setCollapsedGroups = useAppStore((state) => state.setCollapsedGroups)
  const projectCollapseKeys = useMemo(
    () => (groupBy === 'repo' ? getRenderedProjectCollapseKeys(rows) : []),
    [groupBy, rows]
  )
  const allProjectsCollapsed = areAllProjectsCollapsed(projectCollapseKeys, collapsedGroups)
  const handleToggleAllProjects = useCallback(() => {
    const state = useAppStore.getState()
    void state.recordFeatureInteraction('projects-collapse-all')
    setCollapsedGroups(
      setAllProjectsCollapsed(state.collapsedGroups, projectCollapseKeys, !allProjectsCollapsed)
    )
  }, [setCollapsedGroups, projectCollapseKeys, allProjectsCollapsed])
  return { projectCollapseKeys, allProjectsCollapsed, handleToggleAllProjects }
}
