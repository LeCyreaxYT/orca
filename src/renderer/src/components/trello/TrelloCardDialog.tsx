import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { useState } from 'react'
import { CheckCheck, ExternalLink, MessageSquare } from 'lucide-react'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import CommentMarkdown from '@/components/sidebar/CommentMarkdown'
import { activateRetainedAgentRow } from '@/components/sidebar/workspace-card/activity/activate-retained-agent-row'
import { structuredAgentSessionPaneKey } from '../../../../shared/agent-session/view/structured-agent-session-projection'
import type { TrelloBoard, TrelloCard, TrelloRun } from '../../../../shared/trello/trello-types'
import { TrelloStartChat } from './TrelloStartChat'
import { TrelloChecklists } from './TrelloChecklists'
import { trelloRpc } from './trello-rpc'

export function TrelloCardDialog({
  open,
  card,
  board,
  runs,
  error,
  onClose,
  onRefresh,
  onTemplate
}: {
  open: boolean
  card: TrelloCard | null
  board: TrelloBoard
  runs: TrelloRun[]
  error: string | null
  onClose: () => void
  onRefresh: () => void
  onTemplate: (card: TrelloCard) => void
}) {
  const t = useTranslate()
  const worktreeId = useAppStore((state) => state.activeWorktreeId)
  const [accepting, setAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const run = card
    ? runs.findLast(
        (row) => row.cardId === card.id && row.worktreeId === worktreeId && row.sessionId
      )
    : undefined
  const canOpen = useAppStore((state) =>
    Boolean(
      run?.tabId && state.unifiedTabsByWorktree[run.worktreeId]?.some((tab) => tab.id === run.tabId)
    )
  )
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose()
        }
      }}
    >
      <DialogContent surface="solid" className="flex max-h-[85vh] flex-col sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{card?.name ?? t('trello.loadingCard', 'Loading card…')}</DialogTitle>
          <DialogDescription>
            {board.name}
            {card ? ` · ${board.lists.find((list) => list.id === card.listId)?.name ?? ''}` : ''}
          </DialogDescription>
        </DialogHeader>
        {error || acceptError ? (
          <p role="alert" className="text-sm text-destructive">
            {acceptError ?? error}
          </p>
        ) : null}
        {card ? (
          <>
            <div className="flex flex-wrap gap-2 border-b border-border pb-4">
              {worktreeId && card.listId !== board.workflow?.done && !card.complete ? (
                <TrelloStartChat worktreeId={worktreeId} card={card} board={board} />
              ) : null}
              {canOpen && run?.sessionId && run.tabId ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    activateRetainedAgentRow(
                      run.worktreeId,
                      run.tabId!,
                      structuredAgentSessionPaneKey(run.tabId!, run.sessionId!)
                    )
                  }}
                >
                  <MessageSquare className="size-4" />
                  {t('trello.openChat', 'Open chat')}
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => openAppHttpLink(card.url)}>
                <ExternalLink className="size-4" />
                {t('trello.openCard', 'Open in Trello')}
              </Button>
              <Button variant="ghost" onClick={() => onTemplate(card)}>
                {t('trello.useTemplate', 'Use as template')}
              </Button>
            </div>
            {!worktreeId ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  'trello.chooseWorkspace',
                  'Select a workspace in the left sidebar before starting an agent.'
                )}
              </p>
            ) : null}
            <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto pr-2 scrollbar-sleek lg:grid-cols-3">
              <div className="min-w-0 space-y-6 lg:col-span-2">
                <CommentMarkdown
                  className="max-w-prose text-sm"
                  content={card.description || t('trello.noDescription', 'No description')}
                  variant="document"
                />
                <TrelloChecklists card={card} onChanged={onRefresh} />
              </div>
              <aside className="min-w-0 space-y-4 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
                <h3 className="text-sm font-medium">{t('trello.notes', 'Latest notes')}</h3>
                {card.comments.length ? (
                  card.comments.map((note) => (
                    <div key={note.id} className="border-t border-border pt-4">
                      <CommentMarkdown className="text-sm" content={note.text} variant="document" />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('trello.noNotes', 'No notes yet.')}
                  </p>
                )}
                {card.commentsHasMore ? (
                  <Button variant="link" onClick={() => openAppHttpLink(card.url)}>
                    {t('trello.moreNotes', 'Read earlier notes in Trello')}
                  </Button>
                ) : null}
              </aside>
            </div>
            {run?.phase === 'review' && card.listId === run.workflow.review ? (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">
                  {t(
                    'trello.acceptanceCopy',
                    'Go through the card, results and remaining checks together in the chat. Give final acceptance when you are ready.'
                  )}
                </p>
                <Button
                  disabled={accepting}
                  onClick={() => {
                    setAccepting(true)
                    setAcceptError(null)
                    void trelloRpc('accept', { runId: run.id })
                      .then(() => {
                        onClose()
                        onRefresh()
                      })
                      .catch((error) => setAcceptError(String(error)))
                      .finally(() => setAccepting(false))
                  }}
                >
                  <CheckCheck className="size-4" />
                  {t('trello.accept', 'Accept and move to Done')}
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
