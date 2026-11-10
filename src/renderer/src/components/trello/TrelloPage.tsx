import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslate } from '@/i18n/use-translate'
import { UnsealedCredentialNotice } from '@/components/provider-accounts/UnsealedCredentialNotice'
import type { TrelloCard } from '../../../../shared/trello/trello-types'
import { useTrelloPage } from './use-trello-page'
import { TrelloToolbar } from './TrelloToolbar'
import { TrelloBoardColumns } from './TrelloBoardColumns'
import { TrelloCardDialog } from './TrelloCardDialog'
import { TrelloNewCardDialog } from './TrelloNewCardDialog'
import { TrelloWorkflowControls } from './TrelloWorkflowControls'

export default function TrelloPage() {
  const t = useTranslate()
  const page = useTrelloPage()
  const [creating, setCreating] = useState(false)
  const [newCardListId, setNewCardListId] = useState<string | undefined>()
  const [template, setTemplate] = useState<TrelloCard | null>(null)
  const [configuring, setConfiguring] = useState(false)
  const create = (listId?: string) => {
    setTemplate(null)
    setNewCardListId(listId)
    setCreating(true)
  }
  const failed = (error: unknown) =>
    page.setError(error instanceof Error ? error.message : String(error))
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <TrelloToolbar
        boards={page.boards}
        boardId={page.boardId}
        board={page.board}
        connected={page.status?.connected === true}
        authorizing={page.connecting || page.status?.authorizing === true}
        onBoard={(id) => {
          setConfiguring(false)
          page.setBoardId(id)
        }}
        onRefresh={page.reload}
        onNewCard={() => create()}
        onConfigure={() => setConfiguring((value) => !value)}
        onConnect={() => void page.connect()}
        onCancelConnect={() => void page.cancelConnect().catch(failed)}
        onDisconnect={() => void page.disconnect().catch(failed)}
      />
      {page.status?.credentialProtection === 'plaintext' ? (
        <div className="px-4 py-3">
          <UnsealedCredentialNotice
            protection={page.status.credentialProtection}
            credentialName="Trello"
          />
        </div>
      ) : null}
      {page.error || page.status?.error ? (
        <div role="alert" className="border-b border-border px-4 py-3 text-sm text-destructive">
          {page.error ?? page.status?.error}
        </div>
      ) : null}
      {!page.status ? (
        <div className="flex flex-1 items-center justify-center">
          {page.error ? (
            <Button variant="outline" onClick={page.reload}>
              {t('trello.retry', 'Try again')}
            </Button>
          ) : (
            <Loader2
              className="size-4 animate-spin"
              aria-label={t('trello.loading', 'Loading Trello…')}
            />
          )}
        </div>
      ) : !page.status.connected ? (
        <div className="m-auto max-w-lg space-y-4 px-6 py-10">
          <h2 className="text-lg font-semibold">{t('trello.connect', 'Connect Trello')}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              'trello.connectCopy',
              'Connect your Trello workspace to use its original lists, descriptions and checklists. Start a normal Codex or Claude chat from a card; the AI maintains progress and you give final acceptance.'
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              disabled={page.connecting || page.status.authorizing}
              onClick={() => void page.connect()}
            >
              {page.connecting || page.status.authorizing
                ? t('trello.awaitingAuth', 'Waiting for Trello authorization…')
                : t('trello.connect', 'Connect Trello')}
            </Button>
            {page.connecting || page.status.authorizing ? (
              <Button variant="ghost" onClick={() => void page.cancelConnect().catch(failed)}>
                {t('trello.cancel', 'Cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : page.board ? (
        <>
          {!page.board.workflow || configuring ? (
            <TrelloWorkflowControls
              key={page.board.id}
              board={page.board}
              onSaved={() => {
                setConfiguring(false)
                page.reload()
              }}
              onClose={() => setConfiguring(false)}
            />
          ) : null}
          <TrelloBoardColumns
            board={page.board}
            onCard={page.setCardId}
            onNewCard={create}
            onRefresh={page.reload}
          />
          <TrelloCardDialog
            key={page.cardId ?? 'closed'}
            open={Boolean(page.cardId)}
            card={page.card?.id === page.cardId ? page.card : null}
            board={page.board}
            runs={page.status.runs}
            error={page.error}
            onClose={() => page.setCardId(null)}
            onRefresh={page.reload}
            onTemplate={(card) => {
              page.setCardId(null)
              setTemplate(card)
              setNewCardListId(undefined)
              setCreating(true)
            }}
          />
          {creating ? (
            <TrelloNewCardDialog
              board={page.board}
              template={template}
              initialListId={newCardListId}
              onClose={() => setCreating(false)}
              onCreated={() => {
                setCreating(false)
                page.reload()
              }}
            />
          ) : null}
        </>
      ) : (
        <div className="m-auto p-6 text-sm text-muted-foreground">
          {page.error ? (
            <Button variant="outline" onClick={page.reload}>
              {t('trello.retry', 'Try again')}
            </Button>
          ) : !page.boardsLoaded || page.boards.length ? (
            t('trello.loading', 'Loading Trello…')
          ) : (
            t(
              'trello.noBoards',
              'No accessible boards. Reconnect and choose the Trello workspace containing your boards.'
            )
          )}
        </div>
      )}
    </main>
  )
}
