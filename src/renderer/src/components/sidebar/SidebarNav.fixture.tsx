import { defineFixture } from '../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import SidebarNav from './SidebarNav'

const navigation = defineFixture({
  width: 303,
  store: {
    persistedUIReady: true,
    runtimeEnvironmentCatalogSettled: true,
    setupGuideSidebarDismissed: true,
    preflightStatusChecked: true,
    preflightStatusContextKey: 'host',
    linearStatusChecked: true,
    linearStatusContextKey: 'local#0',
    jiraStatusChecked: true,
    jiraStatusContextKey: 'local#0'
  },
  setup: () => {
    useAppStore.setState((state) =>
      state.settings
        ? {
            settings: {
              ...state.settings,
              showAutomationsButton: true,
              showMobileButton: true,
              showSkillsButton: true,
              showArtifactsButton: true
            }
          }
        : {}
    )
    window.api.ui.set = async () => {}
  },
  render: () => (
    <div className="bg-worktree-sidebar p-2 text-worktree-sidebar-foreground">
      <SidebarNav />
    </div>
  )
})
export const collapsed = navigation
export const expanded = defineFixture({
  ...navigation,
  interact: (frame) => {
    frame.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')?.click()
  }
})
