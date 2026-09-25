import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'
import {
  activityByWeek,
  averageMatchScore,
  averageTimeToOffer,
  funnel,
  matchScoreDistribution,
  outcomes,
  rates,
  timeInStage,
} from '@/services/metrics/computeMetrics'
import { ChartCard } from './components/ChartCard'
import { FunnelChart } from './components/FunnelChart'
import { OutcomeBar } from './components/OutcomeBar'
import { TimeInStageChart } from './components/TimeInStageChart'
import { ActivityChart } from './components/ActivityChart'
import { MatchScoreChart } from './components/MatchScoreChart'

export function MetricsPage() {
  const navigate = useNavigate()
  const applications = useApplicationsStore((state) => state.applications)

  const metrics = useMemo(
    () => ({
      funnel: funnel(applications),
      rates: rates(applications),
      outcomes: outcomes(applications),
      timeInStage: timeInStage(applications),
      timeToOffer: averageTimeToOffer(applications),
      activity: activityByWeek(applications),
      matchDistribution: matchScoreDistribution(applications),
      avgMatch: averageMatchScore(applications),
    }),
    [applications],
  )

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No metrics yet"
        description="Track applications in the pipeline to unlock funnel, conversion, velocity, and match-score analytics."
        action={<Button onClick={() => navigate('/applications')}>Go to Application Tracker</Button>}
      />
    )
  }

  const { rates: rate, timeToOffer, avgMatch } = metrics
  const conversions = metrics.funnel.slice(1).filter((step) => step.count > 0 || step.conversion > 0)

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in space-y-6">
      <PageHeader title="Career Metrics" subtitle="How your search is converting — funnel, response, velocity, and fit." />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricTile label="Applications" value={rate.total} />
        <MetricTile label="Response Rate" value={pct(rate.responseRate)} accent />
        <MetricTile label="Offer Rate" value={pct(rate.offerRate)} accent />
        <MetricTile label="Ghost Rate" value={pct(rate.ghostRate)} />
        <MetricTile label="Avg Time to Offer" value={timeToOffer === null ? '—' : `${Math.round(timeToOffer)}d`} />
        <MetricTile label="Avg Match Score" value={avgMatch === null ? '—' : pct(avgMatch)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Pipeline funnel" subtitle="Applications reaching each stage, with conversion from the prior stage.">
          <FunnelChart steps={metrics.funnel} />
          {conversions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {conversions.map((step) => (
                <span key={step.stage} className="text-xs text-muted bg-surface-2 border border-edge rounded-full px-2 py-1">
                  →{APPLICATION_STAGE_LABELS[step.stage]} {Math.round(step.conversion)}%
                </span>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Outcomes" subtitle="Where your tracked applications currently stand.">
          <OutcomeBar outcomes={metrics.outcomes} />
        </ChartCard>

        <ChartCard title="Velocity" subtitle="Average days spent in each stage before moving on.">
          <TimeInStageChart durations={metrics.timeInStage} />
        </ChartCard>

        <ChartCard title="Match-score distribution" subtitle="ATS match scores across your tracked applications.">
          <MatchScoreChart buckets={metrics.matchDistribution} />
        </ChartCard>

        <ChartCard
          title="Activity over time"
          subtitle="Applications added per week."
          className="lg:col-span-2"
        >
          <ActivityChart weeks={metrics.activity} />
        </ChartCard>
      </div>
    </div>
  )
}

function pct(value: number): string {
  return `${Math.round(value)}%`
}

function MetricTile({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <SectionLabel className="mb-2">{label}</SectionLabel>
      <p className={`text-3xl font-light ${accent ? 'text-success' : 'text-ink-strong'}`}>{value}</p>
    </Card>
  )
}
