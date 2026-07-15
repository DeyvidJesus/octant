import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/SectionLabel'

interface StatCardProps {
  label: string
  value: number | string
  accent?: boolean
}

export function StatCard({ label, value, accent = false }: StatCardProps) {
  return (
    <Card>
      <SectionLabel className="mb-2">{label}</SectionLabel>
      <p className={`text-4xl font-light ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</p>
    </Card>
  )
}
