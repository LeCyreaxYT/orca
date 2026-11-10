import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { installWindowVisibilityInterval } from '@/lib/window-visibility-interval'

export function trelloRpc<T>(method: string, params?: unknown): Promise<T> {
  return callRuntimeRpc<T>({ kind: 'local' }, `trello.${method}`, params)
}

export function watchTrelloChanges(onChanged: () => void): () => void {
  let alive = true
  let timer: ReturnType<typeof setTimeout> | undefined
  let release = (): void => {}
  void window.api.runtime
    .subscribe({ method: 'trello.watch' }, (response) => {
      if (
        !alive ||
        !response.ok ||
        !response.result ||
        typeof response.result !== 'object' ||
        !('type' in response.result) ||
        response.result.type !== 'changed'
      ) {
        return
      }
      clearTimeout(timer)
      timer = setTimeout(onChanged, 250)
    })
    .then((handle) => {
      if (alive) {
        release = handle.unsubscribe
      } else {
        handle.unsubscribe()
      }
    })
    .catch(() => {})
  return () => {
    alive = false
    clearTimeout(timer)
    release()
  }
}

export function readTrelloResource<T>(
  method: string,
  params: unknown,
  receive: (value: T) => void,
  failed: (error: unknown) => void,
  intervalMs?: number
): () => void {
  let alive = true
  let reading = false
  const read = async () => {
    if (!alive || reading) {
      return
    }
    reading = true
    try {
      const value = await trelloRpc<T>(method, params)
      if (alive) {
        receive(value)
      }
    } catch (error) {
      if (alive) {
        failed(error)
      }
    } finally {
      reading = false
    }
  }
  void read()
  const stop = intervalMs
    ? installWindowVisibilityInterval({
        run: () => void read(),
        intervalMs,
        slowWhileUnfocused: true
      })
    : () => {}
  return () => {
    alive = false
    stop()
  }
}
