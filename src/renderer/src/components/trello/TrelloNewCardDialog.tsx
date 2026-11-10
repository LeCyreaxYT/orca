import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import { createNonSecureContextUuid } from '../../../../shared/non-secure-context-uuid'
import type { TrelloBoard, TrelloCard } from '../../../../shared/trello/trello-types'
import { trelloRpc } from './trello-rpc'

export function TrelloNewCardDialog({
  board,
  template,
  initialListId,
  onClose,
  onCreated
}: {
  board: TrelloBoard
  template: TrelloCard | null
  initialListId?: string
  onClose: () => void
  onCreated: () => void
}) {
  const t = useTranslate()
  const id = useId()
  const [name, setName] = useState('')
  const [description, setDescription] = useState(
    template?.description ?? '## Ziel\n\n\n## Umsetzung\n\n\n## Abnahme\n\n\n## Verknüpfte Arbeit\n'
  )
  const [source, setSource] = useState(template)
  const [sourceUrl, setSourceUrl] = useState(template?.url ?? '')
  const [listId, setListId] = useState(
    initialListId ??
      board.lists.find((list) => /^\D*04\s*[–—-]/.test(list.name))?.id ??
      board.lists[0]?.id ??
      ''
  )
  const [requestId, setRequestId] = useState(createNonSecureContextUuid)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ state: string } | null>(null)
  const unconfirmed = receipt?.state === 'pending' || receipt?.state === 'unknown'
  const prepareEdit = () => {
    if (receipt?.state === 'rejected') {
      setRequestId(createNonSecureContextUuid())
      setReceipt(null)
      setError(null)
    }
  }
  const inspect = async () => {
    const result = await trelloRpc<{ state: string } | null>('operation', { requestId })
    setReceipt(result)
    if (result?.state === 'confirmed') {
      onCreated()
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value && !busy) {
          onClose()
        }
      }}
    >
      <DialogContent
        surface="solid"
        showCloseButton={!busy}
        className="flex max-h-[85vh] flex-col sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>{t('trello.newCard', 'New card')}</DialogTitle>
          <DialogDescription>{board.name}</DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-1 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (busy || unconfirmed) {
              return
            }
            setBusy(true)
            setError(null)
            void trelloRpc('create', {
              requestId,
              boardId: board.id,
              listId,
              name,
              description,
              ...(source ? { templateCardId: source.id } : {})
            })
              .then(onCreated)
              .catch(async (error) => {
                setError(String(error))
                await inspect().catch(() => {})
              })
              .finally(() => setBusy(false))
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-sleek">
            <label className="block space-y-1 text-sm" htmlFor={`${id}-title`}>
              <span>{t('trello.title', 'Title')}</span>
              <Input
                autoFocus
                id={`${id}-title`}
                required
                maxLength={512}
                value={name}
                onChange={(event) => {
                  prepareEdit()
                  setName(event.target.value)
                }}
                disabled={busy || unconfirmed}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>{t('trello.list', 'List')}</span>
              <Select
                value={listId}
                onValueChange={(value) => {
                  prepareEdit()
                  setListId(value)
                }}
                disabled={busy || unconfirmed}
              >
                <SelectTrigger aria-label={t('trello.list', 'List')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {board.lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <div className="space-y-2">
              <label className="block space-y-1 text-sm" htmlFor={`${id}-template`}>
                <span>{t('trello.template', 'Template card (optional)')}</span>
                <Input
                  id={`${id}-template`}
                  value={sourceUrl}
                  onChange={(event) => {
                    prepareEdit()
                    setSourceUrl(event.target.value)
                  }}
                  disabled={busy || unconfirmed}
                  placeholder={t('trello.templatePlaceholder', 'https://trello.com/c/…')}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || unconfirmed || !sourceUrl.trim()}
                onClick={() => {
                  setBusy(true)
                  setError(null)
                  void trelloRpc<TrelloCard>('card', { cardId: sourceUrl })
                    .then((card) => {
                      setSource(card)
                      setDescription(card.description)
                    })
                    .catch((error) => setError(String(error)))
                    .finally(() => setBusy(false))
                }}
              >
                {t('trello.loadTemplate', 'Load template')}
              </Button>
              {source ? (
                <p className="text-xs text-muted-foreground">
                  {t(
                    'trello.templateCopy',
                    'Description and checklists from {{name}}; new checklist items start unchecked.',
                    { name: source.name }
                  )}
                </p>
              ) : null}
            </div>
            <label className="block space-y-1 text-sm" htmlFor={`${id}-description`}>
              <span>{t('trello.description', 'Description')}</span>
              <Textarea
                id={`${id}-description`}
                rows={14}
                value={description}
                onChange={(event) => {
                  prepareEdit()
                  setDescription(event.target.value)
                }}
                disabled={busy || unconfirmed}
              />
            </label>
          </div>
          {unconfirmed ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>
                {t(
                  'trello.unconfirmed',
                  'Trello may have saved part of this card. Check the result before creating another card.'
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  void inspect()
                    .catch((error) => setError(String(error)))
                    .finally(() => setBusy(false))
                }}
              >
                {t('trello.inspect', 'Check result')}
              </Button>
              <Button type="button" variant="link" onClick={() => openAppHttpLink(board.url)}>
                {t('trello.inspectBoard', 'Inspect the board in Trello')}
              </Button>
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" disabled={busy || unconfirmed || !name.trim() || !listId}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t('trello.createCard', 'Create card')}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
              {t('trello.cancel', 'Cancel')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
