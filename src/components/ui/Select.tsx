import type { SelectHTMLAttributes } from 'react'

/** The app's dropdown, styled to match Input/Textarea. Spreads native attrs. */
export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full bg-base border border-edge-2 rounded px-3 py-2 text-sm text-ink-2 focus:outline-none focus:border-[#555] ${className}`}
      {...props}
    />
  )
}
