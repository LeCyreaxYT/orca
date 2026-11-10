import { useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { useAgentRowConversationName } from '@/components/dashboard/use-agent-row-conversation-name'
import { getAgentRowPrimaryText } from '../../../../../../shared/agent-status/presentation/agent-row-primary-text'
import { cn } from '@/lib/utils'
import { sidebarChatIdentity } from './sidebar-chat-group-model'

export function SidebarChatDragProvider({
  children,
  onMove
}: {
  children: ReactNode
  onMove: (chatId: string, groupId: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [label, setLabel] = useState<string | null>(null)
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }) =>
        setLabel(typeof active.data.current?.label === 'string' ? active.data.current.label : null)
      }
      onDragCancel={() => setLabel(null)}
      onDragEnd={({ active, over }) => {
        setLabel(null)
        if (over && typeof active.id === 'string' && typeof over.id === 'string') {
          onMove(active.id, over.id)
        }
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {label ? (
          <div className="max-w-72 truncate rounded-md border border-sidebar-border bg-sidebar px-2 py-1.5 text-[13px] text-sidebar-foreground shadow-floating">
            {label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export function SidebarChatDropGroup({
  id,
  name,
  children
}: {
  id: string
  name: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      aria-label={name}
      data-chat-group-id={id}
      className={cn('min-w-0 rounded-md', isOver && 'bg-worktree-sidebar-accent')}
    >
      {children}
    </section>
  )
}

export function SidebarChatDraggable({
  agent,
  children
}: {
  agent: DashboardAgentRow
  children: ReactNode
}) {
  const title = useAgentRowConversationName(agent) ?? getAgentRowPrimaryText(agent.entry)
  return (
    <SidebarChatDraggableRow id={sidebarChatIdentity(agent)} title={title} rowKey={agent.paneKey}>
      {children}
    </SidebarChatDraggableRow>
  )
}

export function SidebarChatDraggableRow({
  id,
  title,
  rowKey = id,
  children
}: {
  id: string
  title: string
  rowKey?: string
  children: ReactNode
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id,
    data: { label: title }
  })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group/chat-row relative flex min-w-0 items-start gap-0.5',
        isDragging && 'opacity-50'
      )}
      onPointerDownCapture={(event) => {
        if (
          event.target instanceof Element &&
          (event.target.closest('button, input, textarea, select') ||
            event.target
              .closest('[data-sidebar-chat-row]')
              ?.getAttribute('data-sidebar-chat-row') !== rowKey)
        ) {
          return
        }
        listeners?.onPointerDown?.(event)
      }}
    >
      {children}
    </div>
  )
}
