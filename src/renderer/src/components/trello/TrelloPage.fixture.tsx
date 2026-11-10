import { defineFixture } from '../../component-fixtures/component-fixture'
import type { TrelloBoard, TrelloCard, TrelloRun } from '../../../../shared/trello/trello-types'
import TrelloPage from './TrelloPage'

const lists = [
  { id: 'vision', name: '🧭 00 – Start & Vision' },
  { id: 'basis', name: '✅ 01 – Vorhandene Grundlage' },
  { id: 'ideas', name: '💡 02 – Ideenpool' },
  { id: 'next', name: '🎯 03 – MVP / Als Nächstes' },
  { id: 'planned', name: '📌 04 – Geplant' },
  { id: 'implementation', name: '🚧 05 – In Umsetzung' },
  { id: 'review', name: '🧪 06 – Test & Abnahme' },
  { id: 'done', name: '🏁 07 – Fertig' }
]
const workflow = { implementation: 'implementation', review: 'review', done: 'done' }
const names = [
  'START HIER – Zielbild, Regeln und Board-Legende',
  'Vorhandene Module und bestätigte Abläufe',
  'Neue Ideen für den Vorlagenimport',
  'Vorlagenformat und Abhängigkeiten festlegen',
  'Export und sichere Übernahme anschließen',
  'Importvorschau mit Konfliktprüfung',
  'Gespeicherte Vorlage erneut öffnen und durchprüfen',
  'Vorlagen und bestehende Datensätze erhalten'
]

function setup(mode: 'connected' | 'disconnected' | 'error' | 'unmapped' = 'connected') {
  let connected = mode !== 'disconnected'
  let authorizing = false
  const cards: TrelloCard[] = lists.map((list, index) => ({
    id: `demo-card-${index}`,
    boardId: 'demo-board',
    listId: list.id,
    name: names[index]!,
    url: 'https://trello.com/c/Example1',
    complete: false,
    hasDescription: true,
    commentCount: 1,
    hasChecklists: true,
    checklistsComplete: true,
    description:
      '## Ziel\nDie bestehende Vorlage sicher übernehmen und im normalen Ablauf nutzen.\n\n## Umsetzung\nDie vorhandene Speicherung und Validierung verwenden. Bestehende Daten bleiben erhalten.\n\n## Abnahme\nVorschau öffnen, gespeicherte Werte prüfen und den Ablauf einmal selbst durchspielen.\n\n## Verknüpfte Arbeit\nVereinbarter Umfang im ausgewählten Arbeitsbereich.',
    checklistTotal: 3,
    checklistDone: 2,
    commentsHasMore: false,
    checklists: [
      {
        id: `checklist-${index}`,
        name: 'Planung · Umsetzung · Testing',
        checkItems: [
          {
            id: 'planning',
            name: 'Planung: Umfang und Abnahmekriterien festgelegt',
            state: 'COMPLETE'
          },
          {
            id: 'implementation',
            name: 'Umsetzung: vorhandenen Ablauf ergänzt',
            state: 'COMPLETE'
          },
          {
            id: 'testing',
            name: 'Testing: nativen Ablauf ansehen und durchklicken',
            state: 'INCOMPLETE'
          }
        ]
      }
    ],
    comments: [
      {
        id: `note-${index}`,
        text: '## Orca · Test & Abnahme\nDie Umsetzung und die gezielten Prüfungen sind abgeschlossen.\n\n### Nachweise und offene Abnahme\nBuild und Verhaltenstests bestanden. Die persönliche Abnahme durch dich steht noch aus.'
      }
    ]
  }))
  const run: TrelloRun = {
    id: '10000000-0000-4000-8000-000000000001',
    cardId: 'demo-card-6',
    boardId: 'demo-board',
    worktreeId: 'trello-demo',
    phase: 'review',
    workflow,
    createdAt: '2026-11-10T00:00:00Z',
    sessionId: 'demo-session',
    tabId: 'demo-tab',
    agent: 'codex'
  }
  const additional = [
    ['basis', 'Berechtigungen und gespeicherte Konfiguration'],
    ['basis', 'Bestätigte Abläufe und vorhandene Schnittstellen'],
    ['basis', 'Bekannte Grenzen der aktuellen Umsetzung'],
    ['ideas', 'Eigene Vorlagen einfacher teilen'],
    ['next', 'Abhängigkeiten vor der Übernahme prüfen'],
    ['planned', 'Fehlende Voraussetzungen verständlich anzeigen'],
    ['planned', 'Vorlagen mit eigener Version und Herkunft speichern'],
    ['planned', 'Abbruch während der Vorschau prüfen'],
    ['planned', 'Vorhandene Daten bei einer Wiederholung erhalten'],
    ['planned', 'Konflikte vor dem Speichern anzeigen'],
    ['planned', 'Einzelne Bestandteile gezielt übernehmen'],
    ['planned', 'Beschreibungen und Hilfetexte vervollständigen'],
    ['planned', 'Import mit neuen internen Kennungen prüfen'],
    ['implementation', 'Referenzen nach der Übernahme neu zuordnen'],
    ['implementation', 'Ergebnis und offene Punkte in der Karte festhalten'],
    ['review', 'Vorschau und gespeicherte Werte vergleichen'],
    ['review', 'Den normalen Ablauf im Programm durchklicken'],
    ['done', 'Vorhandene Nachweise bleiben erhalten']
  ]
  additional.forEach(([listId, name], index) =>
    cards.push({
      ...structuredClone(cards[4]!),
      id: `demo-extra-${index}`,
      listId: listId!,
      name: name!
    })
  )
  const board: TrelloBoard = {
    id: 'demo-board',
    name: 'Demodaten · Projekt-Workflow',
    url: 'https://trello.com/b/Example1',
    lists,
    cards,
    workflow: mode === 'unmapped' ? null : workflow
  }
  for (const card of cards.filter((card) => card.listId === 'done')) {
    for (const item of card.checklists.flatMap((list) => list.checkItems)) {
      item.state = 'COMPLETE'
    }
  }
  const recount = () => {
    for (const card of cards) {
      const items = card.checklists.flatMap((list) => list.checkItems)
      card.checklistTotal = items.length
      card.checklistDone = items.filter((item) => item.state === 'COMPLETE').length
      card.commentCount = card.comments.length
      card.hasDescription = Boolean(card.description.trim())
    }
  }
  window.api.runtime.subscribe = async () => ({ unsubscribe: () => {}, sendBinary: () => {} })
  window.api.shell.openUrl = async () => {}
  window.api.runtime.call = async ({ method, params }) => {
    recount()
    const input = params && typeof params === 'object' ? params : {}
    let result: unknown
    switch (method) {
      case 'trello.status':
        result = {
          connected,
          authorizing,
          credentialProtection: 'sealed',
          selectedBoardId: board.id,
          runs: [run]
        }
        break
      case 'trello.boards':
        result = [{ id: board.id, name: board.name, url: board.url }]
        break
      case 'trello.connect':
        authorizing = true
        result = { authorizationUrl: 'https://trello.com' }
        break
      case 'trello.cancelConnect':
        authorizing = false
        result = null
        break
      case 'trello.disconnect':
        connected = false
        result = null
        break
      case 'trello.board':
        if (mode === 'error') {
          throw new Error('Demo: Trello ist gerade nicht erreichbar. Versuche es erneut.')
        }
        result = board
        break
      case 'trello.card':
        result =
          cards.find((card) => card.id === ('cardId' in input ? input.cardId : null)) ?? cards[0]
        break
      case 'trello.configure':
        board.workflow = workflow
        result = workflow
        break
      case 'trello.accept':
        run.phase = 'accepted'
        cards[6]!.listId = 'done'
        result = run
        break
      case 'trello.check': {
        const card = cards.find((card) => card.id === ('cardId' in input ? input.cardId : null))
        const item = card?.checklists
          .flatMap((list) => list.checkItems)
          .find((item) => item.id === ('itemId' in input ? input.itemId : null))
        if (item) {
          item.state = 'checked' in input && input.checked ? 'COMPLETE' : 'INCOMPLETE'
        }
        result = card
        break
      }
      case 'trello.create': {
        const card = {
          ...structuredClone(cards[0]!),
          id: 'created-demo',
          listId: 'listId' in input ? String(input.listId) : 'planned',
          name: 'name' in input ? String(input.name) : '',
          description: 'description' in input ? String(input.description) : '',
          comments: []
        }
        for (const item of card.checklists.flatMap((list) => list.checkItems)) {
          item.state = 'INCOMPLETE'
        }
        cards.push(card)
        result = card
        break
      }
      default:
        throw new Error(`Unsupported demo request: ${method}`)
    }
    recount()
    return {
      id: 'trello-fixture',
      ok: true,
      result: structuredClone(result),
      _meta: { runtimeId: 'demo-runtime' }
    }
  }
}

function render() {
  return (
    <div style={{ height: 820 }} className="flex flex-col">
      <TrelloPage />
    </div>
  )
}

async function element(selector: string, root: ParentNode = document): Promise<HTMLElement> {
  const existing = root.querySelector<HTMLElement>(selector)
  if (existing) {
    return existing
  }
  return new Promise((resolve, reject) => {
    const observer = new MutationObserver(() => {
      const found = root.querySelector<HTMLElement>(selector)
      if (found) {
        observer.disconnect()
        clearTimeout(timeout)
        resolve(found)
      }
    })
    const timeout = setTimeout(() => {
      observer.disconnect()
      reject(new Error('Demo UI did not finish loading'))
    }, 5000)
    observer.observe(root, { childList: true, subtree: true })
  })
}

export const desktop = defineFixture({
  width: 1200,
  store: { activeWorktreeId: 'trello-demo' },
  setup,
  render
})
export const compact = defineFixture({
  width: 900,
  store: { activeWorktreeId: 'trello-demo' },
  setup,
  render
})
export const card = defineFixture({
  width: 1200,
  store: { activeWorktreeId: 'trello-demo' },
  setup,
  render,
  interact: async (frame) => {
    ;(await element('[data-trello-card-id="demo-card-6"]', frame)).click()
    await element('[role="dialog"] h2')
  }
})
export const newCard = defineFixture({
  width: 900,
  store: { activeWorktreeId: 'trello-demo' },
  setup,
  render,
  interact: async (frame) => {
    ;(await element('[data-trello-new-card]', frame)).click()
    await element('[role="dialog"] input')
  }
})

export const inlineChecks = defineFixture({
  width: 1200,
  store: { activeWorktreeId: 'trello-demo' },
  setup,
  render,
  interact: async (frame) => {
    ;(await element('[data-trello-card-id="demo-card-1"]', frame))
      .closest('article')!
      .querySelector<HTMLButtonElement>('button[aria-expanded]')!
      .click()
    await element('[role="checkbox"]', frame)
  }
})
export const disconnected = defineFixture({
  width: 900,
  setup: () => setup('disconnected'),
  render
})
export const unavailable = defineFixture({ width: 900, setup: () => setup('error'), render })
export const unmapped = defineFixture({ width: 900, setup: () => setup('unmapped'), render })
