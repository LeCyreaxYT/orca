import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { AgentActivityDisplayMode } from '../../../../../../shared/ui-chrome-types'
import { revealCompactAgentCard } from '../../worktree-list/navigation/worktree-sidebar-reveal'

export const SUPPRESS_WORKTREE_LIST_SCROLL_ADJUSTMENT_EVENT =
  'orca-suppress-worktree-list-scroll-adjustment'

export function dispatchSuppressScrollAdjustment(): void {
  window.dispatchEvent(new CustomEvent(SUPPRESS_WORKTREE_LIST_SCROLL_ADJUSTMENT_EVENT))
}

export function useCompactAgentListReveal(
  expanded: boolean,
  mode: AgentActivityDisplayMode,
  list: RefObject<HTMLDivElement | null>
): void {
  const previous = useRef(expanded)
  useLayoutEffect(() => {
    const wasExpanded = previous.current
    previous.current = expanded
    if (!wasExpanded && expanded && mode === 'compact') {
      dispatchSuppressScrollAdjustment()
      const handle = requestAnimationFrame(() => revealCompactAgentCard(list.current))
      return () => cancelAnimationFrame(handle)
    }
    return undefined
  }, [expanded, mode, list])
}
