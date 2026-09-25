import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MatchScoreBucket } from '@/services/metrics/computeMetrics'
import { CHART } from '../chartTheme'
import { ChartTooltip } from './ChartTooltip'
import { EmptyChart } from './EmptyChart'

export function MatchScoreChart({ buckets }: { buckets: MatchScoreBucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0)
  if (total === 0) {
    return <EmptyChart message="Save analyzed jobs to the tracker to see match-score distribution." />
  }

  const max = Math.max(1, ...buckets.map((b) => b.count))

  return (
    <ResponsiveContainer width="100%" height={220}>
      {/* Top margin leaves room for the label above the tallest bar. */}
      <BarChart data={buckets} margin={{ top: 22, right: 12, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tick={{ fill: CHART.tickMuted, fontSize: 11 }} axisLine={{ stroke: CHART.axis }} tickLine={false} />
        <YAxis
          allowDecimals={false}
          domain={[0, Math.max(2, max)]}
          tick={{ fill: CHART.tickMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as MatchScoreBucket | undefined
            return (
              <ChartTooltip
                active={active}
                title={datum ? `Match ${datum.label}` : undefined}
                rows={datum ? [{ label: 'Applications', value: datum.count, color: CHART.series }] : []}
              />
            )
          }}
        />
        <Bar dataKey="count" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
          <LabelList dataKey="count" position="top" fill={CHART.ink} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
