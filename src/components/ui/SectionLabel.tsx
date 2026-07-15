import type { HTMLAttributes } from 'react'

/** The uppercase tracking-widest micro-label used across the app. */
export function SectionLabel({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <h4
      className={`text-xs font-semibold text-muted uppercase tracking-widest ${className}`}
      {...props}
    />
  )
}
