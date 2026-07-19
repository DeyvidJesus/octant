import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { WeeklyActivity } from '@/services/metrics/computeMetrics'
import { formatDate } from '@/utils/dates'
import { CHART } from '../chartTheme'
import { ChartTooltip } from './ChartTooltip'
import { EmptyChart } from './EmptyChart'

interface Datum extends WeeklyActivity {
  label: string
}

export function ActivityChart({ weeks }: { weeks: WeeklyActivity[] }) {
  if (weeks.length === 0) {
    return <EmptyChart message="Add applications to see your weekly activity over time." />
  }

  const data: Datum[] = weeks.map((week) => ({ ...week, label: formatDate(week.weekStart) }))
  const maxCount = Math.max(1, ...data.map((d) => d.count))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.series} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.series} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART.tickMuted, fontSize: 11 }}
          axisLine={{ stroke: CHART.axis }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          domain={[0, Math.max(2, maxCount)]}
          tick={{ fill: CHART.tickMuted, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Tooltip
          cursor={{ stroke: CHART.axis }}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as Datum | undefined
            return (
              <ChartTooltip
                active={active}
                title={datum ? `Week of ${datum.label}` : undefined}
                rows={datum ? [{ label: 'Applications', value: datum.count, color: CHART.series }] : []}
              />
            )
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={CHART.series}
          strokeWidth={2}
          fill="url(#activityFill)"
          isAnimationActive={false}
          dot={{ r: 3, fill: CHART.series, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
