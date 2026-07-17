import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/SectionLabel'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
}

export function ChartCard({ title, subtitle, children, className = '' }: ChartCardProps) {
  return (
    <Card className={className}>
      <SectionLabel>{title}</SectionLabel>
      {subtitle && <p className="text-xs text-faint mt-1">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  )
}
