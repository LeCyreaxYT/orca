import { useCallback, useEffect, useRef, useState } from 'react'
import { trelloRpc, readTrelloResource, watchTrelloChanges } from './trello-rpc'
import { openAppHttpLink } from '@/lib/browser/navigation/app-http-link-open'
import type {
  TrelloBoard,
  TrelloBoardOption,
  TrelloCard,
  TrelloStatus
} from '../../../../shared/trello/trello-types'

export function useTrelloPage() {
  const [status, setStatus] = useState<TrelloStatus | null>(null)
  const [boards, setBoards] = useState<TrelloBoardOption[]>([])
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  const [boardId, setBoardId] = useState('')
  const [board, setBoard] = useState<TrelloBoard | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [card, setCard] = useState<TrelloCard | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const connectGeneration = useRef(0)
  const reload = useCallback(() => setRefresh((value) => value + 1), [])

  useEffect(() => watchTrelloChanges(reload), [reload])

  useEffect(
    () =>
      readTrelloResource<TrelloStatus>(
        'status',
        undefined,
        setStatus,
        (error) => setError(String(error)),
        status?.authorizing ? 1500 : undefined
      ),
    [refresh, status?.authorizing]
  )

  useEffect(() => {
    if (!status?.connected) {
      return
    }
    setBoardsLoaded(false)
    return readTrelloResource<TrelloBoardOption[]>(
      'boards',
      undefined,
      (rows) => {
        setBoards(rows)
        setBoardsLoaded(true)
        setBoardId((current) =>
          rows.some((row) => row.id === current)
            ? current
            : (rows.find((row) => row.id === status.selectedBoardId)?.id ?? rows[0]?.id ?? '')
        )
        setError(null)
      },
      (error) => {
        setBoardsLoaded(true)
        setError(String(error))
      }
    )
  }, [status?.connected, status?.selectedBoardId, refresh])

  useEffect(() => {
    setBoard(null)
    setCardId(null)
  }, [boardId])

  useEffect(() => {
    if (!boardId || !status?.connected) {
      return
    }
    return readTrelloResource<TrelloBoard>(
      'board',
      { boardId },
      (next) => {
        setBoard(next)
        setError(null)
      },
      (error) => setError(String(error)),
      30000
    )
  }, [boardId, status?.connected, refresh])

  useEffect(() => {
    if (!cardId) {
      setCard(null)
      return
    }
    return readTrelloResource<TrelloCard>(
      'card',
      { cardId },
      (next) => {
        setCard(next)
        setError(null)
      },
      (error) => setError(String(error)),
      30000
    )
  }, [cardId, refresh])

  const connect = () => {
    const generation = ++connectGeneration.current
    setConnecting(true)
    setError(null)
    return trelloRpc<{ authorizationUrl: string }>('connect')
      .then((result) => {
        if (generation !== connectGeneration.current) {
          return
        }
        openAppHttpLink(result.authorizationUrl)
        reload()
      })
      .catch((error) => {
        if (generation === connectGeneration.current) {
          setError(String(error))
        }
      })
      .finally(() => {
        if (generation === connectGeneration.current) {
          setConnecting(false)
        }
      })
  }
  const cancelConnect = async () => {
    connectGeneration.current++
    setConnecting(false)
    await trelloRpc('cancelConnect')
    reload()
  }
  const disconnect = async () => {
    connectGeneration.current++
    await trelloRpc('disconnect')
    setBoards([])
    setBoardId('')
    setBoard(null)
    setCardId(null)
    setError(null)
    reload()
  }
  return {
    status,
    boards,
    boardsLoaded,
    board,
    boardId,
    setBoardId,
    cardId,
    setCardId,
    card,
    error,
    setError,
    reload,
    connect,
    cancelConnect,
    disconnect,
    connecting
  }
}
