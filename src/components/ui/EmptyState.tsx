import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-8">
      <Icon size={48} className="text-edge-2 mb-4" aria-hidden />
      <h2 className="text-xl font-medium text-white mb-2">{title}</h2>
      <p className="text-muted text-sm max-w-sm">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
