import { useId, useState } from 'react'
import { Check, Circle, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useTranslate } from '@/i18n/use-translate'
import type { WorkPlan, WorkPlanCommand } from '../../../../shared/work-plans/work-plan'

export function WorkPlanContent({
  plan,
  disabled,
  onUpdate
}: {
  plan: WorkPlan
  disabled: boolean
  onUpdate: (command: WorkPlanCommand | 'run') => void
}) {
  const t = useTranslate()
  const id = useId()
  const [feedback, setFeedback] = useState('')
  const phase = {
    planning: t('components.workPlan.planning', 'Planning'),
    working: t('components.workPlan.working', 'In progress'),
    paused: t('components.workPlan.paused', 'Paused'),
    waiting: t('components.workPlan.waiting', 'Waiting for your input'),
    review: t('components.workPlan.review', 'Ready for your review'),
    accepted: t('components.workPlan.accepted', 'Accepted by you')
  }[plan.phase]
  const gate = plan.phase === 'waiting' || plan.phase === 'review' || plan.phase === 'accepted'
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {phase}
        </p>
        <h3 className="text-base leading-relaxed font-medium break-words">{plan.objective}</h3>
      </div>
      {plan.nextAction ? (
        <p className="text-sm leading-relaxed break-words">{plan.nextAction}</p>
      ) : null}
      {plan.goalControl === 'unconfirmed' || plan.goalControl === 'unsupported' ? (
        <p className="text-sm text-destructive" role="alert">
          {t(
            'components.workPlan.stopUnconfirmed',
            'Automatic goal pause could not be confirmed. Check the native chat and stop its running goal before continuing.'
          )}
        </p>
      ) : null}
      <section className="space-y-3">
        <h4 className="text-sm font-medium">{t('components.workPlan.steps', 'Plan')}</h4>
        <ol className="space-y-3">
          {plan.steps.map((step) => (
            <li key={step.id} className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 shrink-0 text-muted-foreground">
                {step.done ? (
                  <Check
                    className="size-4"
                    aria-label={t('components.workPlan.checked', 'Verified')}
                  />
                ) : (
                  <Circle
                    className="size-4"
                    aria-label={t('components.workPlan.pending', 'Open')}
                  />
                )}
              </span>
              <span className="min-w-0 break-words">{step.title}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="space-y-3 border-t border-border pt-5">
        <h4 className="text-sm font-medium">
          {t('components.workPlan.criteria', 'Acceptance criteria')}
        </h4>
        <ul className="divide-y divide-border">
          {plan.criteria.map((criterion) => (
            <li key={criterion.id} className="space-y-2 py-3 first:pt-0">
              <div className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 shrink-0 text-muted-foreground">
                  {criterion.status === 'passed' ? (
                    <Check className="size-4" />
                  ) : (
                    <Circle className="size-4" />
                  )}
                </span>
                <span className="min-w-0 break-words">{criterion.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {criterion.status === 'passed'
                    ? t('components.workPlan.checked', 'Verified')
                    : criterion.status === 'failed'
                      ? t('components.workPlan.failed', 'Failed')
                      : criterion.status === 'blocked'
                        ? t('components.workPlan.blocked', 'Blocked')
                        : t('components.workPlan.pending', 'Open')}
                </span>
              </div>
              {criterion.evidence ? (
                <p className="pl-6.5 text-xs leading-relaxed break-words text-muted-foreground">
                  {criterion.evidence}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      {plan.strategy ? (
        <section className="space-y-2">
          <h4 className="text-sm font-medium">
            {t('components.workPlan.strategy', 'Current approach')}
          </h4>
          <p className="text-sm leading-relaxed break-words text-muted-foreground">
            {plan.strategy}
          </p>
        </section>
      ) : null}
      <div className="space-y-4 border-t border-border pt-5">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t(
            'components.workPlan.acceptanceHint',
            'The AI records checks and prepares review. Only you give final acceptance.'
          )}
        </p>
        {!gate ? (
          <div className="flex flex-wrap gap-2">
            {plan.phase === 'working' ? (
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  onUpdate({
                    kind: 'phase',
                    phase: 'paused',
                    reason: t('components.workPlan.pauseReason', 'Paused by the user')
                  })
                }
              >
                <Pause className="size-4" />
                {t('components.workPlan.pause', 'Pause goal')}
              </Button>
            ) : (
              <Button disabled={disabled} onClick={() => onUpdate('run')}>
                <Play className="size-4" />
                {t('components.workPlan.start', 'Start with AI')}
              </Button>
            )}
            {plan.criteria.every((entry) => entry.status === 'passed') ? (
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() =>
                  onUpdate({
                    kind: 'phase',
                    phase: 'review',
                    reason: t(
                      'components.workPlan.reviewReason',
                      'Review the verified results together in the chat.'
                    )
                  })
                }
              >
                {t('components.workPlan.requestReview', 'Review results')}
              </Button>
            ) : null}
          </div>
        ) : null}
        {gate && plan.phase !== 'accepted' ? (
          <>
            {plan.phase === 'review' ? (
              <Button disabled={disabled} onClick={() => onUpdate({ kind: 'accept' })}>
                {t('components.workPlan.accept', 'Give final acceptance')}
              </Button>
            ) : null}
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (feedback.trim()) {
                  onUpdate({ kind: 'rework', reason: feedback })
                }
              }}
            >
              <Label htmlFor={id}>
                {t('components.workPlan.feedback', 'Feedback or missing input')}
              </Label>
              <Textarea
                id={id}
                value={feedback}
                maxLength={8000}
                disabled={disabled}
                onChange={(event) => setFeedback(event.target.value)}
                required
              />
              <Button variant="outline" type="submit" disabled={disabled || !feedback.trim()}>
                {t('components.workPlan.rework', 'Continue with this feedback')}
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  )
}
