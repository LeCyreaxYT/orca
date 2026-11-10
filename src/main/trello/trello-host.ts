import { getAppEnvironment } from '../../shared/app-environment'
import { TrelloStore } from './trello-store'
import { TrelloConnection } from './trello-connection'
import { TrelloService } from './trello-service'

const hosts = new Map<string, Promise<{ connection: TrelloConnection; service: TrelloService }>>()

export function getTrelloHost() {
  const root = getAppEnvironment().getPath('userData')
  let host = hosts.get(root)
  if (!host) {
    host = TrelloStore.open(root)
      .then((store) => {
        const connection = new TrelloConnection(store.directory)
        getAppEnvironment().onWillQuit(() => {
          void connection.dispose()
          hosts.delete(root)
        })
        return {
          connection,
          service: new TrelloService(store, (tool, args) => connection.call(tool, args))
        }
      })
      .catch((error: unknown) => {
        hosts.delete(root)
        throw error
      })
    hosts.set(root, host)
  }
  return host
}
