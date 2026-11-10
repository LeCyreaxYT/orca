import { Columns3 } from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/utils'

export function SidebarTrelloButton() {
  const t = useTranslate()
  const active = useAppStore((state) => state.activeView === 'trello')
  const setActiveView = useAppStore((state) => state.setActiveView)
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => setActiveView('trello')}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <Columns3 className="size-4 shrink-0" />
      {t('trello.navigation', 'Trello')}
    </button>
  )
}
