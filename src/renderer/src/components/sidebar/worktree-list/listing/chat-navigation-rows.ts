import type { HostSectionRow } from '../../../../../../shared/sidebar-list/host-section-rows'

export function flatChatNavigationRows(rows: readonly HostSectionRow[]): HostSectionRow[] {
  return rows
    .filter((row) => row.type !== 'header' || row.count === 0)
    .map((row) =>
      row.type === 'item' || row.type === 'folder-workspace' ? { ...row, groupDepth: 0 } : row
    )
}
