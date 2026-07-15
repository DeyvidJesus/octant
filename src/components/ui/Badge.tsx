import type { HTMLAttributes } from 'react'

type BadgeTone = 'default' | 'indigo' | 'emerald' | 'red'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  default: 'bg-surface-2 border-edge-2 text-ink-2',
  indigo: 'bg-indigo-900/30 border-indigo-800/50 text-indigo-300',
  emerald: 'bg-emerald-900/30 border-emerald-800/50 text-emerald-300',
  red: 'bg-red-900/30 border-red-800/50 text-red-300',
}

export function Badge({ tone = 'default', className = '', ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 border rounded text-xs ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    />
  )
}
