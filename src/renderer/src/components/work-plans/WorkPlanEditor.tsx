import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useTranslate } from '@/i18n/use-translate'
import type { WorkPlanCommand } from '../../../../shared/work-plans/work-plan'

export function WorkPlanEditor({
  disabled,
  onCreate
}: {
  disabled: boolean
  onCreate: (command: WorkPlanCommand) => void
}) {
  const t = useTranslate()
  const id = useId()
  const [objective, setObjective] = useState('')
  const [criteria, setCriteria] = useState('')
  const [steps, setSteps] = useState('')
  const lines = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title, index) => ({ id: String(index + 1), title }))
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) {
          onCreate({ kind: 'create', objective, criteria: lines(criteria), steps: lines(steps) })
        }
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t(
          'components.workPlan.empty',
          'Define the result and how to verify it. The AI can also create this plan while you work in the chat.'
        )}
      </p>
      <div className="space-y-2">
        <Label htmlFor={`${id}-goal`}>{t('components.workPlan.objective', 'Goal')}</Label>
        <Textarea
          id={`${id}-goal`}
          required
          maxLength={8000}
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-criteria`}>
          {t('components.workPlan.criteria', 'Acceptance criteria')}
        </Label>
        <Textarea
          id={`${id}-criteria`}
          required
          value={criteria}
          onChange={(event) => setCriteria(event.target.value)}
          disabled={disabled}
          placeholder={t(
            'components.workPlan.criteriaPlaceholder',
            'One observable result per line'
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-steps`}>{t('components.workPlan.steps', 'Plan')}</Label>
        <Textarea
          id={`${id}-steps`}
          required
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          disabled={disabled}
          placeholder={t('components.workPlan.stepsPlaceholder', 'One work step per line')}
        />
      </div>
      <Button
        type="submit"
        disabled={disabled || !objective.trim() || !lines(criteria).length || !lines(steps).length}
      >
        {t('components.workPlan.create', 'Create plan')}
      </Button>
    </form>
  )
}
