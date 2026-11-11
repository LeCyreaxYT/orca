import { ChevronDown, Crosshair, Kanban, Settings, Users } from 'lucide-react'
import { useAppStore } from '@/store'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useActiveAccountOwner } from '@/runtime/provider-accounts/ownership/use-active-account-owner'
import { requestScrollToCurrentWorkspaceReveal } from '@/lib/scroll-to-current-workspace-status'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

const LOCAL_OWNER: RuntimeClientTarget = { kind: 'local' }

export function SidebarProfileMenu({
  showUsage,
  onShowUsageChange,
  workspaceBoardOpen,
  onWorkspaceBoardToggle
}: {
  showUsage: boolean
  onShowUsageChange: (show: boolean) => void
  workspaceBoardOpen: boolean
  onWorkspaceBoardToggle: () => void
}) {
  const t = useTranslate()
  const profile = useAppStore((state) =>
    state.orcaProfiles.find((profile) => profile.id === state.activeOrcaProfileId)
  )
  const cloud = useAppStore((state) => state.orcaProfileAuthStatus?.cloud)
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const openSettingsPage = useAppStore((state) => state.openSettingsPage)
  const { target } = useActiveAccountOwner(LOCAL_OWNER)
  const name =
    cloud?.displayName?.trim() || profile?.name || t('sidebar.footer.profile', 'Personal')
  const initials =
    profile?.avatar.initials ||
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
  const accounts = () => {
    openSettingsTarget({ pane: 'accounts', repoId: null, hostScope: target })
    openSettingsPage()
  }
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t('sidebar.footer.profileMenu', '{{name}} · Profile and accounts', { name })}
        >
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-worktree-sidebar-accent text-xs font-medium"
            aria-hidden
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name}</span>
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-60 max-w-[calc(100vw-1rem)]"
      >
        <DropdownMenuItem onSelect={accounts}>
          <Users className="size-4" />
          {t('sidebar.footer.accounts', 'Manage accounts')}
        </DropdownMenuItem>
        <DropdownMenuCheckboxItem checked={showUsage} onCheckedChange={onShowUsageChange}>
          {t('sidebar.footer.showUsage', 'Show usage')}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onWorkspaceBoardToggle}>
          <Kanban className="size-4" />
          {workspaceBoardOpen
            ? t('auto.components.sidebar.SidebarToolbar.a30e34eb5c', 'Close workspace board')
            : t('auto.components.sidebar.SidebarToolbar.49f62c5665', 'Workspace board')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={requestScrollToCurrentWorkspaceReveal}>
          <Crosshair className="size-4" />
          {t(
            'auto.components.sidebar.ScrollToCurrentWorkspaceToolbarButton.23989bb663',
            'Reveal active workspace'
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openSettingsPage()}>
          <Settings className="size-4" />
          {t('sidebar.footer.settings', 'Settings')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
