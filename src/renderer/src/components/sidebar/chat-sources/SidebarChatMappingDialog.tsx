import { useEffect, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebarChatWorkspaces } from './use-sidebar-chat-workspaces'
import { useAppStore } from '@/store'
import { useTranslate } from '@/i18n/use-translate'
import {
  isPathInsideOrEqual,
  normalizeRuntimePathForComparison
} from '../../../../../shared/cross-platform-path'
import {
  EMPTY_CODEX_PROJECT_STRUCTURE,
  type CodexProjectStructure
} from '../../../../../shared/ai-vault/contracts/codex-project-structure'
import type { SidebarChatSource } from '../../../../../shared/sidebar-chat-groups'
import { useSidebarChatHistory } from './sidebar-chat-history-store'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../shared/non-secure-context-uuid'

type WorkspaceOption = { id: string; displayName: string; path: string }
type MappingChoice = { projectId: string; workspaceId: string; claude: boolean }
type ClaudeChoice = { id: string; path: string; workspaceId: string }
const NONE = '__unmapped__'

function WorkspaceSelect({
  value,
  workspaces,
  onChange,
  label
}: {
  value: string
  workspaces: readonly WorkspaceOption[]
  onChange: (id: string) => void
  label: string
}) {
  const t = useTranslate()
  return (
    <Select value={value || NONE} onValueChange={(value) => onChange(value === NONE ? '' : value)}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t('sidebar.chatSources.unmapped', 'Do not assign')}</SelectItem>
        {workspaces.map((workspace) => (
          <SelectItem key={workspace.id} value={workspace.id}>
            <span title={workspace.path}>{workspace.displayName}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function SidebarChatMappingForm({
  structure,
  workspaces,
  choices,
  setChoices,
  claudeFolders,
  setClaudeFolders
}: {
  structure: CodexProjectStructure
  workspaces: readonly WorkspaceOption[]
  choices: MappingChoice[]
  setChoices: (choices: MappingChoice[]) => void
  claudeFolders: ClaudeChoice[]
  setClaudeFolders: (folders: ClaudeChoice[]) => void
}) {
  const t = useTranslate()
  return (
    <div className="@container scrollbar-sleek max-h-[60vh] space-y-6 overflow-y-auto px-1">
      <div className="space-y-1">
        <div className="hidden grid-cols-2 gap-4 pb-2 text-xs font-medium text-muted-foreground @md:grid">
          <span>{t('sidebar.chatSources.codexProjects', 'Codex projects')}</span>
          <span>{t('sidebar.chatSources.target', 'Orca workspace')}</span>
        </div>
        {structure.projects.map((project) => {
          const choice = choices.find((choice) => choice.projectId === project.id)
          const change = (patch: Partial<MappingChoice>) =>
            setChoices(
              choices.map((value) =>
                value.projectId === project.id ? { ...value, ...patch } : value
              )
            )
          return (
            <div
              key={project.id}
              className="grid min-w-0 grid-cols-1 items-start gap-3 border-b border-border py-3 last:border-0 @md:grid-cols-2 @md:gap-x-4"
            >
              <div className="min-w-0 space-y-1">
                <div className="truncate text-sm font-medium" title={project.name}>
                  {project.name}
                </div>
                <div className="truncate text-xs text-muted-foreground" title={project.paths[0]}>
                  {project.paths[0]}
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                <WorkspaceSelect
                  value={choice?.workspaceId ?? ''}
                  workspaces={workspaces}
                  label={t('sidebar.chatSources.assignProject', 'Workspace for {{name}}', {
                    name: project.name
                  })}
                  onChange={(workspaceId) => change({ workspaceId })}
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={choice?.claude ?? true}
                    onCheckedChange={(value) => change({ claude: value === true })}
                  />
                  {t('sidebar.chatSources.includeClaude', 'Include Claude chats in this folder')}
                </label>
              </div>
            </div>
          )
        })}
        {!structure.projects.length ? (
          <p className="py-3 text-sm text-muted-foreground">
            {t(
              'sidebar.chatSources.noCodex',
              'No local Codex projects found. You can still assign Claude folders below.'
            )}
          </p>
        ) : null}
      </div>
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {t('sidebar.chatSources.otherClaude', 'Other Claude folders')}
        </summary>
        <div className="space-y-3 pt-3">
          {claudeFolders.map((folder, index) => (
            <div key={folder.id} className="grid grid-cols-1 gap-3 @md:grid-cols-2 @md:gap-4">
              <Input
                aria-label={t('sidebar.chatSources.claudeFolder', 'Claude project folder')}
                placeholder={t('sidebar.chatSources.folderPath', 'Folder path')}
                value={folder.path}
                onChange={(event) =>
                  setClaudeFolders(
                    claudeFolders.map((value, i) =>
                      i === index ? { ...value, path: event.target.value } : value
                    )
                  )
                }
              />
              <WorkspaceSelect
                label={t(
                  'sidebar.chatSources.claudeTarget',
                  'Workspace for Claude folder {{index}}',
                  { index: index + 1 }
                )}
                value={folder.workspaceId}
                workspaces={workspaces}
                onChange={(workspaceId) =>
                  setClaudeFolders(
                    claudeFolders.map((value, i) =>
                      i === index ? { ...value, workspaceId } : value
                    )
                  )
                }
              />
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setClaudeFolders([
                ...claudeFolders,
                { id: createBrowserUuid(), path: '', workspaceId: '' }
              ])
            }
          >
            {t('sidebar.chatSources.addFolder', 'Add folder')}
          </Button>
        </div>
      </details>
    </div>
  )
}

export function SidebarChatMappingDialog() {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [structure, setStructure] = useState(EMPTY_CODEX_PROJECT_STRUCTURE)
  const [choices, setChoices] = useState<MappingChoice[]>([])
  const [claudeFolders, setClaudeFolders] = useState<ClaudeChoice[]>([])
  const allWorktrees = useSidebarChatWorkspaces()
  const workspaces = allWorktrees.filter(
    (workspace) => !workspace.isArchived && (!workspace.hostId || workspace.hostId === 'local')
  )
  const workspacesKey = JSON.stringify(
    workspaces.map(({ id, displayName, path }) => ({ id, displayName, path }))
  )
  useEffect(() => {
    if (!open) {
      return
    }
    let active = true
    setLoading(true)
    setError(null)
    void window.api.aiVault
      .codexProjectStructure()
      .then((structure) => {
        if (!active) {
          return
        }
        const mappings = useAppStore.getState().sidebarChatGroupsByWorktree
        const samePath = (left: string, right: string) =>
          normalizeRuntimePathForComparison(left) === normalizeRuntimePathForComparison(right)
        const candidates: WorkspaceOption[] = JSON.parse(workspacesKey)
        setStructure(structure)
        setChoices(
          structure.projects.map((project) => {
            const saved = Object.entries(mappings).find(([, group]) =>
              group.sources?.some(
                (source) =>
                  source.agent === 'codex' &&
                  (source.projectId === project.id ||
                    (!structure.projects.some((current) => current.id === source.projectId) &&
                      samePath(source.path, project.paths[0]))) &&
                  source.executionHostId === 'local'
              )
            )
            const match =
              candidates.find((workspace) => samePath(workspace.path, project.paths[0])) ??
              candidates
                .filter((workspace) => isPathInsideOrEqual(workspace.path, project.paths[0]))
                .sort((a, b) => b.path.length - a.path.length)[0]
            return {
              projectId: project.id,
              workspaceId: saved?.[0] ?? match?.id ?? '',
              claude: saved
                ? saved[1].sources?.some(
                    (source) =>
                      source.agent === 'claude' &&
                      (source.projectId === project.id || samePath(source.path, project.paths[0]))
                  ) === true
                : true
            }
          })
        )
        const roots = new Set(
          structure.projects.map((project) => normalizeRuntimePathForComparison(project.paths[0]))
        )
        setClaudeFolders(
          Object.entries(mappings).flatMap(([workspaceId, state]) =>
            (state.sources ?? [])
              .filter(
                (source) =>
                  source.agent === 'claude' &&
                  source.executionHostId === 'local' &&
                  !roots.has(normalizeRuntimePathForComparison(source.path))
              )
              .map((source) => ({ id: createBrowserUuid(), workspaceId, path: source.path }))
          )
        )
      })
      .catch((error) => active && setError(String(error)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [open, workspacesKey])
  const save = () => {
    const state = useAppStore.getState()
    const byWorkspace = new Map<string, SidebarChatSource[]>()
    const add = (id: string, source: SidebarChatSource) =>
      byWorkspace.set(id, [...(byWorkspace.get(id) ?? []), source])
    for (const choice of choices) {
      const project = structure.projects.find((project) => project.id === choice.projectId)
      if (!project || !workspaces.some((workspace) => workspace.id === choice.workspaceId)) {
        continue
      }
      add(choice.workspaceId, {
        agent: 'codex',
        projectId: project.id,
        path: project.paths[0],
        executionHostId: 'local'
      })
      if (choice.claude) {
        add(choice.workspaceId, {
          agent: 'claude',
          path: project.paths[0],
          projectId: project.id,
          executionHostId: 'local'
        })
      }
    }
    for (const folder of claudeFolders) {
      if (
        folder.path.trim() &&
        workspaces.some((workspace) => workspace.id === folder.workspaceId)
      ) {
        add(folder.workspaceId, {
          agent: 'claude',
          path: folder.path.trim(),
          executionHostId: 'local'
        })
      }
    }
    for (const id of new Set([
      ...Object.keys(state.sidebarChatGroupsByWorktree),
      ...byWorkspace.keys()
    ])) {
      const existing = state.sidebarChatGroupsByWorktree[id]?.sources ?? []
      state.editSidebarChatGroup(id, {
        kind: 'sources',
        sources: [
          ...existing.filter((source) => source.executionHostId !== 'local'),
          ...(byWorkspace.get(id) ?? [])
        ]
      })
    }
    state.setAgentActivityDisplayMode('full')
    if (!state.worktreeCardProperties.includes('inline-agents')) {
      state.setWorktreeCardProperties([...state.worktreeCardProperties, 'inline-agents'])
    }
    useSidebarChatHistory.setState({ structure })
    setOpen(false)
  }
  const label = t('sidebar.chatSources.title', 'Assign chats')
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              className="text-muted-foreground"
            >
              <Link2 className="size-3.5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            {t(
              'sidebar.chatSources.description',
              'Choose where Codex projects and local Claude chats appear. New conversations are added automatically; existing Orca chats keep their place.'
            )}
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('sidebar.chatSources.loading', 'Reading projects…')}
          </div>
        ) : error ? (
          <p role="alert" className="text-sm text-destructive">
            {t(
              'sidebar.chatSources.failed',
              'Could not read Codex projects. Close and reopen this dialog to retry.'
            )}
          </p>
        ) : (
          <SidebarChatMappingForm
            {...{ structure, workspaces, choices, setChoices, claudeFolders, setClaudeFolders }}
          />
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button disabled={loading || !!error} onClick={save}>
            {t('sidebar.chatSources.apply', 'Apply assignments')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
