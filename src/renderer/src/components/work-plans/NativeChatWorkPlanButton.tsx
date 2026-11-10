import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'
import { WorkPlanContent } from './WorkPlanContent'
import { WorkPlanEditor } from './WorkPlanEditor'
import { useWorkPlan } from './use-work-plan'

const LOCAL: RuntimeClientTarget = { kind: 'local' }
export function NativeChatWorkPlanButton({
  sessionId,
  target = LOCAL,
  labelled = false
}: {
  sessionId: string
  target?: RuntimeClientTarget
  labelled?: boolean
}) {
  const owner = target.kind === 'local' ? 'local' : target.environmentId
  return (
    <WorkPlanControl
      key={`${owner}:${sessionId}`}
      sessionId={sessionId}
      target={target}
      labelled={labelled}
    />
  )
}

function WorkPlanControl({
  sessionId,
  target = LOCAL,
  labelled = false
}: {
  sessionId: string
  target?: RuntimeClientTarget
  labelled?: boolean
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const state = useWorkPlan(sessionId, target, open)
  const title = t('components.workPlan.title', 'Planning & goals')
  return (
    <>
      {labelled ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen(true)}
        >
          <ListChecks className="size-4 shrink-0 text-worktree-sidebar-foreground/30" />
          <span>{title}</span>
        </button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="pane-title"
              size="icon-xs"
              aria-label={title}
              onClick={(event) => {
                event.stopPropagation()
                setOpen(true)
              }}
            >
              <ListChecks className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            {title}
          </TooltipContent>
        </Tooltip>
      )}
      <Sheet modal={false} open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <div className="border-b border-border">
            <SheetHeader>
              <div className="space-y-1.5 pr-8">
                <SheetTitle>{title}</SheetTitle>
                <SheetDescription>
                  {t(
                    'components.workPlan.description',
                    'Goal, work steps and evidence for this chat.'
                  )}
                </SheetDescription>
              </div>
            </SheetHeader>
          </div>
          <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto p-6">
            {state.error ? (
              <div className="mb-5 space-y-2">
                <p role="alert" className="text-sm text-destructive break-words">
                  {state.error}
                </p>
                <Button size="sm" variant="outline" disabled={state.pending} onClick={state.retry}>
                  {t('components.workPlan.reload', 'Reload plan')}
                </Button>
              </div>
            ) : null}
            {!state.ready && !state.error ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t('components.workPlan.loading', 'Loading plan…')}
              </p>
            ) : state.plan ? (
              <WorkPlanContent
                plan={state.plan}
                disabled={!state.ready || state.pending}
                onUpdate={(command) => void state.update(command)}
              />
            ) : state.ready ? (
              <WorkPlanEditor
                disabled={state.pending}
                onCreate={(command) => void state.update(command)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
