import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-surface border border-edge rounded-xl p-6 ${className}`} {...props} />
}
