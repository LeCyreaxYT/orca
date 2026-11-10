import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTranslate } from '@/i18n/use-translate'
import type { TrelloBoard } from '../../../../shared/trello/trello-types'
import { trelloRpc } from './trello-rpc'

export function TrelloWorkflowControls({
  board,
  onSaved,
  onClose
}: {
  board: TrelloBoard
  onSaved: () => void
  onClose: () => void
}) {
  const t = useTranslate()
  const [draft, setDraft] = useState(board.workflow ?? { implementation: '', review: '', done: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fields = [
    { key: 'implementation' as const, label: t('trello.implementation', 'Implementation') },
    { key: 'review' as const, label: t('trello.review', 'Test / Acceptance') },
    { key: 'done' as const, label: t('trello.done', 'Done') }
  ]
  return (
    <div className="space-y-2 border-t border-border px-5 py-3">
      <p className="text-sm">
        {t(
          'trello.mapCopy',
          'Choose the existing lists for the AI workflow. Your lists keep their names and order.'
        )}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {fields.map((field) => (
          <label key={field.key} className="min-w-44 flex-1 space-y-1 text-xs">
            <span>{field.label}</span>
            <Select
              value={draft[field.key]}
              onValueChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
            >
              <SelectTrigger className="w-full" aria-label={field.label}>
                <SelectValue placeholder={t('trello.chooseList', 'Choose a list')} />
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
        ))}
        <Button
          disabled={busy || !draft.implementation || !draft.review || !draft.done}
          onClick={() => {
            setBusy(true)
            setError(null)
            void trelloRpc('configure', { boardId: board.id, workflow: draft })
              .then(() => {
                onSaved()
              })
              .catch((error) => setError(String(error)))
              .finally(() => setBusy(false))
          }}
        >
          {t('trello.saveWorkflow', 'Save workflow')}
        </Button>
        {board.workflow ? (
          <Button variant="ghost" onClick={onClose}>
            {t('trello.cancel', 'Cancel')}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
