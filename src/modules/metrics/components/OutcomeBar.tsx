import type { OutcomeBreakdown } from '@/services/metrics/computeMetrics'
import { STATUS } from '../chartTheme'
import { EmptyChart } from './EmptyChart'

const SEGMENTS: { key: keyof OutcomeBreakdown; label: string; color: string }[] = [
  { key: 'offer', label: 'Offer', color: STATUS.good },
  { key: 'active', label: 'Active', color: STATUS.neutral },
  { key: 'rejected', label: 'Rejected', color: STATUS.critical },
  { key: 'withdrawn', label: 'Withdrawn', color: STATUS.serious },
  { key: 'ghosted', label: 'Ghosted', color: STATUS.muted },
]

export function OutcomeBar({ outcomes }: { outcomes: OutcomeBreakdown }) {
  const total = SEGMENTS.reduce((sum, segment) => sum + outcomes[segment.key], 0)
  if (total === 0) {
    return <EmptyChart message="Track applications to see how their outcomes break down." />
  }

  const present = SEGMENTS.filter((segment) => outcomes[segment.key] > 0)

  return (
    <div>
      <div className="flex gap-0.5 h-3 rounded-full overflow-hidden" role="img" aria-label="Outcome breakdown">
        {present.map((segment) => (
          <div
            key={segment.key}
            style={{ width: `${(outcomes[segment.key] / total) * 100}%`, backgroundColor: segment.color }}
            title={`${segment.label}: ${outcomes[segment.key]}`}
          />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {SEGMENTS.map((segment) => (
          <li key={segment.key} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: segment.color }} aria-hidden />
            <span className="text-muted">{segment.label}</span>
            <span className="ml-auto text-ink-strong tabular-nums">{outcomes[segment.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
