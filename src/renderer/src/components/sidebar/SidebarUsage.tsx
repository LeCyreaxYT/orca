import { ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store'
import { AgentIcon } from '@/components/agent/icons/AgentIcon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ProviderDetailsMenu } from '@/components/status-bar/ProviderDetailsMenu'
import { getUsageRosterRowState } from '@/components/status-bar/usage-roster-row-state'
import {
  getUsageOwnerHostScope,
  useOwnerUsageRateLimits
} from '@/components/status-bar/use-owner-usage-rate-limits'
import { getUsageProviderAccountsSectionId } from '@/components/status-bar/usage-provider-settings-target'
import { useResetCountdownClock } from '@/hooks/useResetCountdownClock'
import { useTranslate } from '@/i18n/use-translate'
import {
  getDisplayedUsagePercentage,
  normalizeUsagePercentageDisplay
} from '../../../../shared/usage-percentage-display'
import { formatWindowLabel } from '../../../../shared/rate-limit-window-label'
import { formatResetDuration } from '../../../../shared/rate-limit-reset-format'

export default function SidebarUsage() {
  const t = useTranslate()
  const local = useAppStore((state) => state.rateLimits)
  const { rateLimits, remoteOwner } = useOwnerUsageRateLimits(local)
  const openSettingsTarget = useAppStore((state) => state.openSettingsTarget)
  const openSettingsPage = useAppStore((state) => state.openSettingsPage)
  const display = normalizeUsagePercentageDisplay(
    useAppStore((state) => state.usagePercentageDisplay)
  )
  const providers = [rateLimits.codex, rateLimits.claude]
  const now = useResetCountdownClock(
    providers.flatMap((provider) => [provider?.session?.resetsAt, provider?.weekly?.resetsAt])
  )
  const unit =
    display === 'remaining'
      ? t('auto.components.status.bar.usageUnitLabel.remaining', 'Remaining')
      : t('auto.components.status.bar.usageUnitLabel.used', 'Used')
  const manage = (provider: 'codex' | 'claude') => {
    openSettingsTarget({
      pane: 'accounts',
      repoId: null,
      hostScope: getUsageOwnerHostScope(remoteOwner),
      sectionId: getUsageProviderAccountsSectionId(provider) ?? undefined
    })
    openSettingsPage()
  }
  return (
    <section
      data-sidebar-usage=""
      className="border-t border-worktree-sidebar-border px-2 pt-3 pb-2"
      aria-label={t('sidebar.footer.usage', 'Usage')}
    >
      <div className="flex items-baseline justify-between gap-2 px-2 pb-1 text-xs">
        <span className="font-medium">{t('sidebar.footer.usage', 'Usage')}</span>
        <span className="text-2xs text-muted-foreground">{unit}</span>
      </div>
      {(['codex', 'claude'] as const).map((agent, index) => {
        const provider = providers[index]
        const label = agent === 'codex' ? 'Codex' : 'Claude'
        const windows = [
          {
            key: 'session',
            label: provider?.session
              ? formatWindowLabel(provider.session.windowMinutes)
              : t('sidebar.footer.session', '5h'),
            window: provider?.session
          },
          { key: 'weekly', label: t('sidebar.footer.week', 'Week'), window: provider?.weekly }
        ]
        const hasUsage = windows.some((window) => window.window != null)
        const status = provider ? getUsageRosterRowState(provider, hasUsage, t) : null
        const body = (
          <>
            <span className="mb-1.5 flex items-center gap-2 text-xs">
              <AgentIcon agent={agent} size={14} />
              <span>{label}</span>
              <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
            </span>
            {hasUsage ? (
              <span className="grid grid-cols-2 gap-4">
                {windows.map(({ key, label: windowLabel, window }) => {
                  const value = window
                    ? getDisplayedUsagePercentage(window.usedPercent, display)
                    : null
                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <span className="min-w-0">
                          <span className="mb-1 flex justify-between gap-1 text-2xs text-muted-foreground">
                            <span>{windowLabel}</span>
                            <span className="tabular-nums text-worktree-sidebar-foreground">
                              {value === null ? '—' : `${Math.round(value)} %`}
                            </span>
                          </span>
                          <span
                            className="block h-1 overflow-hidden rounded-full bg-worktree-sidebar-border"
                            role={value === null ? undefined : 'meter'}
                            aria-label={`${label} · ${windowLabel} · ${unit}`}
                            aria-valuenow={value ?? undefined}
                            aria-valuemin={value === null ? undefined : 0}
                            aria-valuemax={value === null ? undefined : 100}
                          >
                            {value !== null ? (
                              <span
                                className="block h-full rounded-full bg-muted-foreground"
                                style={{ width: `${value}%` }}
                              />
                            ) : null}
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {window?.resetsAt != null
                          ? t('sidebar.footer.reset', 'Resets in {{duration}}', {
                              duration: formatResetDuration(window.resetsAt - now)
                            })
                          : t('sidebar.footer.noWindow', 'No usage data for this window')}
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </span>
            ) : (
              <span className="block text-2xs text-muted-foreground">
                {status?.statusLabel ?? t('sidebar.footer.connect', 'Connect account')}
              </span>
            )}
          </>
        )
        const className =
          'block w-full rounded-md px-2 py-2 text-left hover:bg-worktree-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        return provider ? (
          <ProviderDetailsMenu
            key={agent}
            provider={provider}
            compact={false}
            iconOnly={false}
            ariaLabel={label}
            trigger={
              <button
                type="button"
                className={className}
                aria-label={`${label} · ${t('sidebar.footer.usage', 'Usage')}`}
              >
                {body}
              </button>
            }
          >
            <DropdownMenuItem onSelect={() => manage(agent)}>
              {t('sidebar.footer.accounts', 'Manage accounts')}
            </DropdownMenuItem>
          </ProviderDetailsMenu>
        ) : (
          <button key={agent} type="button" className={className} onClick={() => manage(agent)}>
            {body}
          </button>
        )
      })}
    </section>
  )
}
