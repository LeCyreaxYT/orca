import * as React from 'react'
import * as ProgressPrimitive from 'radix-ui/progress'

import { cn } from '@/lib/utils'

function Progress({
  className,
  value,
  size = 'default',
  tone = 'default',
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  size?: 'default' | 'compact'
  tone?: 'default' | 'success'
}) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-primary/20',
        size === 'compact' && 'h-1',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          'h-full w-full flex-1 bg-primary transition-all duration-300 ease-out motion-reduce:transition-none',
          tone === 'success' && 'bg-status-success'
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
