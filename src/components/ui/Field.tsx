import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  htmlFor?: string
  className?: string
  children: ReactNode
}

/** Label + control, the repeated pattern across every editor form. */
export function Field({ label, htmlFor, className = '', children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs text-faint mb-1 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}
