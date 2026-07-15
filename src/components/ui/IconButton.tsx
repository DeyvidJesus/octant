import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Accessible label — icon-only buttons must always carry one. */
  label: string
  tone?: 'default' | 'danger'
}

export function IconButton({ icon: Icon, label, tone = 'default', className = '', ...props }: IconButtonProps) {
  const toneClass = tone === 'danger' ? 'text-faint hover:text-red-400' : 'text-faint hover:text-ink-2'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`p-1.5 rounded-md transition-colors hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${toneClass} ${className}`}
      {...props}
    >
      <Icon size={15} aria-hidden />
    </button>
  )
}
