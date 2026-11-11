import { useState } from 'react'
import { createNonSecureContextUuid as createBrowserUuid } from '../../../../../../shared/non-secure-context-uuid'
import { Check, Ellipsis, FolderInput, FolderPlus, Pencil, Pin, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useAppStore } from '@/store'
import {
  GENERAL_CHAT_GROUP,
  PINNED_CHAT_GROUP,
  type SidebarChatGroupEdit
} from '../../../../../../shared/sidebar-chat-groups'
import { useSidebarChatWorkspaces } from '../../chat-sources/use-sidebar-chat-workspaces'

export type SidebarChatGroupOption = { id: string; name: string }

export function SidebarChatGroupName({
  name = '',
  onSave,
  trigger,
  initiallyOpen = false,
  onClose
}: {
  name?: string
  onSave: (name: string) => void
  trigger: React.ReactNode
  initiallyOpen?: boolean
  onClose?: () => void
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(initiallyOpen)
  const [draft, setDraft] = useState(name)
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (value) {
          setDraft(name)
        } else {
          onClose?.()
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64" onClick={(event) => event.stopPropagation()}>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (draft.trim()) {
              onSave(draft.trim())
              setOpen(false)
              onClose?.()
            }
          }}
        >
          <Input
            autoFocus
            aria-label={t('sidebar.chatGroups.groupName', 'Group name')}
            placeholder={t('sidebar.chatGroups.groupName', 'Group name')}
            value={draft}
            maxLength={80}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!draft.trim()}
            aria-label={t('sidebar.chatGroups.save', 'Save group')}
          >
            <Check className="size-4" />
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function SidebarChatAddGroup({
  worktreeId,
  iconOnly = false
}: {
  worktreeId: string
  iconOnly?: boolean
}) {
  const t = useTranslate()
  const edit = useAppStore((state) => state.editSidebarChatGroup)
  return (
    <SidebarChatGroupName
      onSave={(name) => edit(worktreeId, { kind: 'add', id: createBrowserUuid(), name })}
      trigger={
        <Button
          type="button"
          variant={iconOnly ? 'ghost' : 'pane-title'}
          size={iconOnly ? 'icon-xs' : 'xs'}
          aria-label={t('sidebar.chatGroups.add', 'New group')}
          className={iconOnly ? undefined : 'mt-1 justify-start'}
        >
          <FolderPlus className="size-3.5" />
          {!iconOnly && t('sidebar.chatGroups.add', 'New group')}
        </Button>
      }
    />
  )
}

export function SidebarChatRowMenu({
  worktreeId,
  chatId,
  groupId,
  options
}: {
  worktreeId: string
  chatId: string
  groupId: string
  options: readonly SidebarChatGroupOption[]
}) {
  const t = useTranslate()
  const edit = useAppStore((state) => state.editSidebarChatGroup)
  const moveWorkspace = useAppStore((state) => state.moveSidebarChatToWorkspace)
  const workspaces = useSidebarChatWorkspaces()
  const host = workspaces.find((workspace) => workspace.id === worktreeId)?.hostId ?? 'local'
  const destinations = workspaces.filter(
    (workspace) =>
      workspace.id !== worktreeId && !workspace.isArchived && (workspace.hostId ?? 'local') === host
  )
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="row-action"
          size="icon-xs"
          aria-label={t('sidebar.chatGroups.move', 'Move chat')}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Ellipsis className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem
          onSelect={() =>
            edit(worktreeId, {
              kind: 'move',
              chatId,
              groupId: groupId === PINNED_CHAT_GROUP ? GENERAL_CHAT_GROUP : PINNED_CHAT_GROUP
            })
          }
        >
          <Pin className="size-3.5" />
          {groupId === PINNED_CHAT_GROUP
            ? t('sidebar.chatGroups.unpin', 'Unpin chat')
            : t('sidebar.chatGroups.pin', 'Pin chat')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options
          .filter((option) => option.id !== groupId)
          .map((option) => (
            <DropdownMenuItem
              key={option.id}
              onSelect={() => edit(worktreeId, { kind: 'move', chatId, groupId: option.id })}
            >
              {option.name}
            </DropdownMenuItem>
          ))}
        {destinations.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="size-3.5" />
                {t('sidebar.chatGroups.moveWorkspace', 'Move to workspace')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <div className="max-h-72 overflow-y-auto scrollbar-sleek">
                  {destinations.map((workspace) => (
                    <DropdownMenuItem
                      key={workspace.id}
                      onSelect={() => moveWorkspace(worktreeId, workspace.id, chatId)}
                      title={workspace.path}
                    >
                      <span className="max-w-64 truncate">{workspace.displayName}</span>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function SidebarChatCustomGroupMenu({
  option,
  edit
}: {
  option: SidebarChatGroupOption
  edit: (edit: SidebarChatGroupEdit) => void
}) {
  const t = useTranslate()
  const [renaming, setRenaming] = useState(false)
  if (renaming) {
    return (
      <SidebarChatGroupName
        name={option.name}
        initiallyOpen
        onClose={() => setRenaming(false)}
        onSave={(name) => edit({ kind: 'rename', id: option.id, name })}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('sidebar.chatGroups.options', 'Group options')}
          >
            <Ellipsis className="size-3" />
          </Button>
        }
      />
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('sidebar.chatGroups.options', 'Group options')}
        >
          <Ellipsis className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setRenaming(true)}>
          <Pencil className="size-3.5" />
          {t('sidebar.chatGroups.rename', 'Rename group')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => edit({ kind: 'remove', id: option.id })}>
          <Trash2 className="size-3.5" />
          {t('sidebar.chatGroups.remove', 'Remove group')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
