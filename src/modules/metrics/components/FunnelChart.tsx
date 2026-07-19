import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { FunnelStep } from '@/services/metrics/computeMetrics'
import { APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'
import { CHART } from '../chartTheme'
import { ChartTooltip } from './ChartTooltip'

interface FunnelDatum extends FunnelStep {
  label: string
}

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const data: FunnelDatum[] = steps.map((step) => ({ ...step, label: APPLICATION_STAGE_LABELS[step.stage] }))
  const max = Math.max(1, ...data.map((d) => d.count))

  return (
    <ResponsiveContainer width="100%" height={data.length * 44 + 16}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 8 }}>
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
            const datum = payload?.[0]?.payload as FunnelDatum | undefined
            return (
              <ChartTooltip
                active={active}
                title={datum?.label}
                rows={
                  datum
                    ? [
                        { label: 'Reached', value: datum.count, color: CHART.series },
                        { label: 'Conversion', value: `${Math.round(datum.conversion)}%` },
                      ]
                    : []
                }
              />
            )
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
          {data.map((datum) => (
            <Cell key={datum.stage} fill={CHART.series} />
          ))}
          <LabelList dataKey="count" position="right" fill={CHART.ink} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
