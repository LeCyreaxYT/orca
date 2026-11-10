import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { useTranslate } from '@/i18n/use-translate'
import { cn } from '@/lib/utils'
import type { TrelloCard } from '../../../../shared/trello/trello-types'
import { trelloRpc } from './trello-rpc'

export function TrelloChecklists({
  card,
  onChanged
}: {
  card: TrelloCard
  onChanged: (card: TrelloCard) => void
}) {
  const t = useTranslate()
  const id = useId()
  const [checking, setChecking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-5">
      {card.checklists.map((list) => {
        const done = list.checkItems.filter(
          (item) => item.state.toUpperCase() === 'COMPLETE'
        ).length
        const total = list.checkItems.length
        const complete = total > 0 && done === total
        return (
          <section key={list.id} className="space-y-2">
            <h3 className="flex items-start gap-2 text-xs font-medium">
              <span className="min-w-0 flex-1 break-words">{list.name}</span>
              <span
                className={cn(
                  'shrink-0 tabular-nums text-muted-foreground',
                  complete && 'text-status-success'
                )}
              >
                {done}/{total}
              </span>
            </h3>
            <Progress
              value={total ? (done / total) * 100 : 0}
              aria-label={list.name}
              size="compact"
              tone={complete ? 'success' : 'default'}
            />
            <ul className="space-y-2 text-xs">
              {list.checkItems.map((item) => {
                const checked = item.state.toUpperCase() === 'COMPLETE'
                const itemId = `${id}-${item.id}`
                return (
                  <li key={item.id} className="flex items-start gap-2">
                    <Checkbox
                      id={itemId}
                      className="mt-0.5 shrink-0"
                      checked={checked}
                      disabled={Boolean(checking)}
                      onCheckedChange={(value) => {
                        setChecking(item.id)
                        setError(null)
                        void trelloRpc<TrelloCard>('check', {
                          cardId: card.id,
                          checklistId: list.id,
                          itemId: item.id,
                          checked: value === true
                        })
                          .then(onChanged)
                          .catch((error) => setError(String(error)))
                          .finally(() => setChecking(null))
                      }}
                    />
                    <label
                      htmlFor={itemId}
                      className={cn(
                        'min-w-0 flex-1 cursor-pointer break-words leading-relaxed',
                        checked && 'text-muted-foreground line-through'
                      )}
                    >
                      {item.name}
                    </label>
                    {checking === item.id ? (
                      <Loader2
                        className="mt-0.5 size-3 shrink-0 animate-spin"
                        aria-label={t('trello.savingCheck', 'Saving checklist item…')}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
