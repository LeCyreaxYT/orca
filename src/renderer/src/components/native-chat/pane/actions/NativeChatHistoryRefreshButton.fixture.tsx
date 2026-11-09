import { defineFixture } from '../../../../component-fixtures/component-fixture'
import { ReloadConversationButton } from './NativeChatHistoryRefreshButton'

export const reload = defineFixture({
  width: 240,
  render: () => (
    <div className="relative bg-background p-6 pb-16">
      <div
        className="pane-title-bar"
        data-pane-title-surface="dark"
        data-chromeless=""
        data-active-pane=""
      >
        <div className="pane-title-actions ml-auto">
          <ReloadConversationButton reload={async () => {}} />
        </div>
      </div>
    </div>
  )
})
