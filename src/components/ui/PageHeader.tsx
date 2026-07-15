import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-end mb-8 gap-4 flex-wrap">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        {subtitle && <p className="text-muted text-sm mt-2">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}
