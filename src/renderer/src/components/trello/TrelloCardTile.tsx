import { useEffect, useState } from 'react'
import { AlignLeft, ChevronDown, Loader2, MessageSquare, SquareCheck } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslate } from '@/i18n/use-translate'
import type { TrelloCard, TrelloCardSummary } from '../../../../shared/trello/trello-types'
import { TrelloChecklists } from './TrelloChecklists'
import { trelloRpc } from './trello-rpc'

export function TrelloCardTile({
  card,
  onOpen,
  onRefresh
}: {
  card: TrelloCardSummary
  onOpen: () => void
  onRefresh: () => void
}) {
  const t = useTranslate()
  const [expanded, setExpanded] = useState(false)
  const [detail, setDetail] = useState<TrelloCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!expanded) {
      return
    }
    let alive = true
    setError(null)
    void trelloRpc<TrelloCard>('card', { cardId: card.id })
      .then((result) => {
        if (alive) {
          setDetail(result)
        }
      })
      .catch((error) => {
        if (alive) {
          setError(String(error))
        }
      })
    return () => {
      alive = false
    }
  }, [card, expanded, retry])
  const shown = detail && expanded ? detail : card
  const complete = shown.checklistTotal > 0 && shown.checklistDone === shown.checklistTotal
  const checklistLabel = shown.checklistsComplete
    ? t('trello.checklistProgress', '{{done}} of {{total}} checklist items completed', {
        done: shown.checklistDone,
        total: shown.checklistTotal
      })
    : t('trello.showChecklists', 'Show checklists')
  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <article className="rounded-lg border border-border/60 bg-card text-card-foreground transition-colors hover:bg-accent/50 dark:bg-secondary dark:hover:bg-secondary/80">
        <button
          type="button"
          data-trello-card-id={card.id}
          onClick={onOpen}
          title={card.name}
          className="block w-full rounded-t-lg px-3 pt-2.5 pb-1.5 text-left text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="line-clamp-4 block break-words leading-snug">{card.name}</span>
        </button>
        <div className="flex min-h-7 items-center gap-2 px-2 pb-2 text-xs text-muted-foreground">
          {card.hasDescription ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpen}
                  className="rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('trello.readDescription', 'Read description')}
                >
                  <AlignLeft className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('trello.readDescription', 'Read description')}</TooltipContent>
            </Tooltip>
          ) : null}
          {card.commentCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpen}
                  className="flex items-center gap-1 rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t('trello.readComments', 'Read comments')}
                >
                  <MessageSquare className="size-3.5" />
                  <span className="tabular-nums">
                    {card.commentCount}
                    {card.commentsHasMore ? '+' : ''}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t('trello.readComments', 'Read comments')}</TooltipContent>
            </Tooltip>
          ) : null}
          {shown.hasChecklists ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger
                  variant="counter"
                  tone={complete ? 'success' : 'default'}
                  aria-label={checklistLabel}
                >
                  <SquareCheck className="size-3.5" />
                  {shown.checklistsComplete
                    ? `${shown.checklistDone}/${shown.checklistTotal}`
                    : '…'}
                  <ChevronDown
                    className={cn('size-3 transition-transform', expanded && 'rotate-180')}
                  />
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent>{checklistLabel}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
        <CollapsibleContent>
          <div className="border-t border-border px-3 pt-3 pb-3">
            {error ? (
              <div className="space-y-2">
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
                <Button variant="ghost" size="sm" onClick={() => setRetry((value) => value + 1)}>
                  {t('trello.retry', 'Try again')}
                </Button>
              </div>
            ) : detail ? (
              <TrelloChecklists
                card={detail}
                onChanged={(next) => {
                  setDetail(next)
                  onRefresh()
                }}
              />
            ) : (
              <Loader2
                className="size-3.5 animate-spin"
                aria-label={t('trello.loadingCard', 'Loading card…')}
              />
            )}
          </div>
        </CollapsibleContent>
      </article>
    </Collapsible>
  )
}
