import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'subtle' | 'ghost' | 'accent'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-white text-black hover:bg-gray-200 font-semibold',
  subtle: 'bg-surface-2 text-white border border-edge-2 hover:bg-white hover:text-black hover:border-white font-medium',
  ghost: 'text-muted hover:text-ink-2 hover:bg-surface font-medium',
  accent: 'bg-emerald-600/10 text-emerald-500 border border-emerald-600/20 hover:bg-emerald-600/20 font-medium',
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
