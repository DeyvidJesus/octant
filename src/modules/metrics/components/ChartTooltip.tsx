import type { ReactNode } from 'react'

interface TooltipRow {
  label: string
  value: ReactNode
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  title?: ReactNode
  rows: TooltipRow[]
}

/** Shared dark-surface tooltip body for all metric charts. */
export function ChartTooltip({ active, title, rows }: ChartTooltipProps) {
  if (!active || rows.length === 0) return null
  return (
    <div className="rounded-lg border border-edge-2 bg-surface px-3 py-2 shadow-lg">
      {title !== undefined && <div className="text-xs text-muted mb-1">{title}</div>}
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2 text-sm text-ink-2">
          {row.color && <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />}
          <span className="text-muted">{row.label}</span>
          <span className="ml-auto font-medium text-ink-strong tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  )
}
