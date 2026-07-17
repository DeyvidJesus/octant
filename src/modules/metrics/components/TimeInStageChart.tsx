import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { StageDuration } from '@/services/metrics/computeMetrics'
import { APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'
import { CHART } from '../chartTheme'
import { ChartTooltip } from './ChartTooltip'
import { EmptyChart } from './EmptyChart'

interface Datum extends StageDuration {
  label: string
  days: number
}

export function TimeInStageChart({ durations }: { durations: StageDuration[] }) {
  if (durations.length === 0) {
    return <EmptyChart message="Move applications between stages to measure how long each takes." />
  }

  const data: Datum[] = durations.map((d) => ({
    ...d,
    label: APPLICATION_STAGE_LABELS[d.stage],
    days: Math.round(d.avgDays * 10) / 10,
  }))
  const max = Math.max(1, ...data.map((d) => d.days))

  return (
    <ResponsiveContainer width="100%" height={data.length * 40 + 16}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 8 }}>
        <XAxis type="number" domain={[0, max]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={92}
          tick={{ fill: CHART.tickMuted, fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as Datum | undefined
            return (
              <ChartTooltip
                active={active}
                title={datum?.label}
                rows={
                  datum
                    ? [
                        { label: 'Avg time', value: `${datum.days}d`, color: CHART.series },
                        { label: 'Samples', value: datum.samples },
                      ]
                    : []
                }
              />
            )
          }}
        />
        <Bar dataKey="days" fill={CHART.series} radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={false}>
          <LabelList dataKey="days" position="right" fill={CHART.ink} fontSize={12} formatter={(value) => `${value}d`} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
