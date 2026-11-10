import { defineFixture } from '../../component-fixtures/component-fixture'
import {
  WorkPlan,
  changeWorkPlan,
  WorkPlanUpdateParams
} from '../../../../shared/work-plans/work-plan'
import { NativeChatWorkPlanButton } from './NativeChatWorkPlanButton'

const at = '2026-11-11T00:00:00Z'
function setup(mode: 'working' | 'review' | 'waiting' | 'empty' | 'error') {
  let plan: WorkPlan | null =
    mode === 'empty'
      ? null
      : WorkPlan.parse({
          sessionId: 'fixture-chat',
          objective: 'Demodaten · Vorlage übernehmen und im normalen Ablauf prüfen',
          revision: 3,
          phase: mode === 'error' ? 'working' : mode,
          steps: [
            { id: 'implement', title: 'Bestehende Speicherung anschließen', done: true },
            {
              id: 'verify',
              title: 'Gespeicherte Vorlage erneut öffnen und prüfen',
              done: mode === 'review'
            }
          ],
          criteria: [
            {
              id: 'save',
              title: 'Vorhandene Werte bleiben nach dem Speichern erhalten',
              status: 'passed',
              evidence:
                'Vorlage geschlossen und erneut geöffnet: Name und konfigurierte Werte stimmen überein.'
            },
            {
              id: 'view',
              title: 'Die Oberfläche zeigt die gespeicherten Werte',
              status: mode === 'review' ? 'passed' : 'blocked',
              evidence:
                mode === 'review'
                  ? 'Importvorschau und gespeicherte Ansicht einzeln durchgegangen.'
                  : 'Der Ziel-Client ist noch nicht verbunden. Die visuelle Prüfung ist offen.'
            }
          ],
          strategy:
            'Gespeicherte Daten zuerst prüfen, danach den echten Ablauf in der Oberfläche ansehen.',
          nextAction:
            mode === 'review'
              ? 'Ergebnisse gemeinsam im Chat durchgehen und selbst abnehmen.'
              : 'Nach Verbindung des Clients die offene Ansicht prüfen.',
          noProgress: mode === 'waiting' ? 3 : 0,
          updatedAt: at,
          history: [],
          goalControl: mode === 'waiting' ? 'paused' : undefined
        })
  let receive: ((value: WorkPlan | null) => void) | undefined
  window.api.runtime.subscribe = async (_request, callback) => {
    receive = (value) =>
      callback({ id: 'fixture', ok: true, result: value, _meta: { runtimeId: 'fixture' } })
    if (mode === 'error') {
      callback({
        id: 'fixture',
        ok: false,
        error: {
          code: 'offline',
          message:
            'Der Orca-Host ist gerade nicht erreichbar. Verbinde ihn erneut und lade den Plan.'
        },
        _meta: { runtimeId: 'fixture' }
      })
    } else {
      receive(plan)
    }
    return {
      unsubscribe: () => {
        receive = undefined
      },
      sendBinary: () => {}
    }
  }
  window.api.runtime.call = async ({ method, params }) => {
    if (method === 'workPlan.update') {
      const input = WorkPlanUpdateParams.parse(params)
      plan = changeWorkPlan(plan, 'fixture-chat', input.command, true, at)
      receive?.(plan)
    }
    return { id: 'fixture', ok: true, result: plan, _meta: { runtimeId: 'fixture' } }
  }
}
function fixture(mode: Parameters<typeof setup>[0], width = 1200) {
  return defineFixture({
    width,
    setup: () => setup(mode),
    render: () => (
      <div className="h-[1000px] bg-background p-4 text-foreground">
        <NativeChatWorkPlanButton sessionId="fixture-chat" />
      </div>
    ),
    interact: async (frame) => {
      frame.querySelector<HTMLButtonElement>('button')?.click()
      await new Promise<void>((resolve) => {
        const observer = new MutationObserver(() => {
          if (!document.querySelector('[role="dialog"] h2')) {
            return
          }
          observer.disconnect()
          resolve()
        })
        observer.observe(document.body, { childList: true, subtree: true })
        if (document.querySelector('[role="dialog"] h2')) {
          observer.disconnect()
          resolve()
        }
      })
    }
  })
}
export const review = fixture('review')
export const working = fixture('working')
export const waiting = fixture('waiting')
export const empty = fixture('empty')
export const unavailable = fixture('error')
export const narrow = fixture('review', 375)
