import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type ButtonVariant = 'primary' | 'subtle' | 'ghost' | 'accent'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-inverse text-inverse-ink hover:bg-inverse-hover font-semibold',
  subtle: 'bg-surface-2 text-ink-strong border border-edge-2 hover:bg-inverse hover:text-inverse-ink hover:border-ink-strong font-medium',
  ghost: 'text-muted hover:text-ink-2 hover:bg-surface font-medium',
  accent: 'bg-success-strong/10 text-success-strong border border-success-strong/20 hover:bg-success-strong/20 font-medium',
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn('inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong', VARIANT_CLASSES[variant], className)}
      {...props}
    />
  )
}
