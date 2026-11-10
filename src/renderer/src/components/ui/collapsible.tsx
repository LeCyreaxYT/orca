'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import * as CollapsiblePrimitive from 'radix-ui/collapsible'

function Collapsible({
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>): React.JSX.Element {
  return <CollapsiblePrimitive.Root data-slot="collapsible" {...props} />
}

const collapsibleTriggerVariants = cva('', {
  variants: {
    variant: {
      default: '',
      counter:
        'flex items-center gap-1 rounded px-1.5 py-1 text-xs tabular-nums text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      sidebar:
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      row: 'group flex w-full cursor-pointer items-center justify-between gap-4 rounded-md bg-transparent py-2 text-left text-sm font-medium outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-accent/50'
    },
    tone: { default: '', success: 'bg-status-success-background text-status-success' }
  },
  defaultVariants: { variant: 'default', tone: 'default' }
})

function CollapsibleTrigger({
  className,
  variant,
  tone,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger> &
  VariantProps<typeof collapsibleTriggerVariants>): React.JSX.Element {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn(collapsibleTriggerVariants({ variant, tone }), className)}
      {...props}
    />
  )
}

const collapsibleContentVariants = cva('', {
  variants: {
    animation: {
      none: '',
      // Grows and shrinks with its content, so what follows moves with it instead of jumping.
      height: 'collapsible-height-content'
    }
  },
  defaultVariants: { animation: 'none' }
})

function CollapsibleContent({
  className,
  animation,
  ...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Content> &
  VariantProps<typeof collapsibleContentVariants>): React.JSX.Element {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn(collapsibleContentVariants({ animation }), className)}
      {...props}
    />
  )
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
