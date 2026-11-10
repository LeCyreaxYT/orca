import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import type { TrelloBoard, TrelloCardSummary } from '../../../../shared/trello/trello-types'
import { TrelloCardTile } from './TrelloCardTile'

export function TrelloBoardColumns({
  board,
  onCard,
  onNewCard,
  onRefresh
}: {
  board: TrelloBoard
  onCard: (id: string) => void
  onNewCard: (listId: string) => void
  onRefresh: () => void
}) {
  const t = useTranslate()
  const grouped = useMemo(() => {
    const result = new Map<string, TrelloCardSummary[]>(board.lists.map((list) => [list.id, []]))
    for (const card of board.cards) {
      result.get(card.listId)?.push(card)
    }
    return result
  }, [board.cards, board.lists])
  return (
    <div className="flex min-h-0 min-w-0 flex-1 items-start gap-3 overflow-x-auto p-4 scrollbar-sleek">
      {board.lists.map((list) => {
        const cards = grouped.get(list.id) ?? []
        return (
          <section
            key={list.id}
            className="flex max-h-full w-64 shrink-0 flex-col gap-2 rounded-xl bg-muted/40 p-2 dark:bg-card"
            aria-label={list.name}
          >
            <h2 className="flex min-h-9 items-center gap-2 px-2 text-sm font-medium">
              <span className="min-w-0 flex-1">{list.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{cards.length}</span>
            </h2>
            <div className="flex min-h-0 flex-col gap-2 overflow-y-auto scrollbar-sleek">
              {cards.map((card) => (
                <TrelloCardTile
                  key={card.id}
                  card={card}
                  onOpen={() => onCard(card.id)}
                  onRefresh={onRefresh}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 justify-start"
              onClick={() => onNewCard(list.id)}
            >
              <Plus className="size-3.5" />
              {t('trello.addCard', 'Add a card')}
            </Button>
          </section>
        )
      })}
    </div>
  )
}
