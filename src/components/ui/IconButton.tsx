import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  /** Accessible label — icon-only buttons must always carry one. */
  label: string
  tone?: 'default' | 'danger'
}

export function IconButton({ icon: Icon, label, tone = 'default', className, ...props }: IconButtonProps) {
  const toneClass = tone === 'danger' ? 'text-faint hover:text-danger' : 'text-faint hover:text-ink-2'
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('p-1.5 rounded-md transition-colors hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong', toneClass, className)}
      {...props}
    >
      <Icon size={15} aria-hidden />
    </button>
  )
}
