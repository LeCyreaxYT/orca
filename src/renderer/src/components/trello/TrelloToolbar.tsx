import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import {
  Check,
  ChevronDown,
  Columns3,
  Ellipsis,
  ExternalLink,
  Plus,
  RefreshCw,
  Settings2,
  Unplug
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslate } from '@/i18n/use-translate'
import type { TrelloBoard, TrelloBoardOption } from '../../../../shared/trello/trello-types'

export function TrelloToolbar({
  boards,
  boardId,
  board,
  connected,
  authorizing,
  onBoard,
  onRefresh,
  onNewCard,
  onConfigure,
  onConnect,
  onDisconnect,
  onCancelConnect
}: {
  boards: TrelloBoardOption[]
  boardId: string
  board: TrelloBoard | null
  connected: boolean
  authorizing: boolean
  onBoard: (id: string) => void
  onRefresh: () => void
  onNewCard: () => void
  onConfigure: () => void
  onConnect: () => void
  onDisconnect: () => void
  onCancelConnect: () => void
}) {
  const t = useTranslate()
  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      <Columns3 className="size-4 text-muted-foreground" />
      <h1 className="text-sm font-medium">{t('trello.navigation', 'Trello')}</h1>
      {connected ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t('trello.board', 'Board')}>
              <span className="max-w-64 truncate">
                {boards.find((row) => row.id === boardId)?.name ??
                  t('trello.chooseBoard', 'Choose a board')}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {boards.map((row) => (
              <DropdownMenuItem key={row.id} onSelect={() => onBoard(row.id)}>
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                {row.id === boardId ? <Check className="size-3.5" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <div className="flex-1" />
      {board ? (
        <Button size="sm" onClick={onNewCard} data-trello-new-card="">
          <Plus className="size-3.5" />
          {t('trello.newCard', 'New card')}
        </Button>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t('trello.refresh', 'Refresh board')}
            onClick={onRefresh}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('trello.refresh', 'Refresh board')}</TooltipContent>
      </Tooltip>
      {connected ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('trello.boardOptions', 'Board options')}
            >
              <Ellipsis className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              {t('trello.policy', 'AI maintains progress · Final acceptance by you')}
            </DropdownMenuLabel>
            {board ? (
              <>
                <DropdownMenuItem onSelect={onConfigure}>
                  <Settings2 className="size-3.5" />
                  {t('trello.configure', 'Map workflow')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => openAppHttpLink(board.url)}>
                  <ExternalLink className="size-3.5" />
                  {t('trello.openBoard', 'Open board')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem disabled={authorizing} onSelect={onConnect}>
              <RefreshCw className="size-3.5" />
              {t('trello.reconnect', 'Reconnect')}
            </DropdownMenuItem>
            {authorizing ? (
              <DropdownMenuItem onSelect={onCancelConnect}>
                {t('trello.cancel', 'Cancel')}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={onDisconnect}>
              <Unplug className="size-3.5" />
              {t('trello.disconnect', 'Disconnect Trello')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  )
}
