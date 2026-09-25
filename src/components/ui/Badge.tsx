import type { HTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type BadgeTone = 'default' | 'info' | 'success' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-surface-2 border-edge-2 text-ink-2',
  info: 'bg-info-deep/30 border-info-deep/50 text-info-soft',
  success: 'bg-success-deep/30 border-success-deep/50 text-success-soft',
  danger: 'bg-danger-deep/30 border-danger-deep/50 text-danger-soft',
}

export function Badge({ tone = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2 py-1 border rounded text-xs', TONE_CLASSES[tone], className)}
      {...props}
    />
  )
}
