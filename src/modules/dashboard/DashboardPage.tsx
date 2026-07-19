import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { useInterviewPrepStore } from '@/stores/interviewPrepStore'
import type { InterviewQuestionCategory, UserSkill } from '@/types/interviewPrep'
import { MASTERY_THRESHOLD } from '@/services/interviewPrep/mastery'
import { INTERVIEW_STAGES, TERMINAL_STAGES } from '@/constants/applicationStages'
import { isDue } from '@/utils/dates'
import { activityByWeek, funnel } from '@/services/metrics/computeMetrics'
import { ChartCard } from '@/modules/metrics/components/ChartCard'
import { FunnelChart } from '@/modules/metrics/components/FunnelChart'
import { ActivityChart } from '@/modules/metrics/components/ActivityChart'
import { StatCard } from './components/StatCard'

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function getAverageMasteryByCategory(skills: UserSkill[], category: InterviewQuestionCategory) {
  const categorySkills = skills.filter((skill) => skill.category === category)
  if (categorySkills.length === 0) return 0

  const totalMastery = categorySkills.reduce((sum, skill) => sum + skill.mastery, 0)
  return totalMastery / categorySkills.length
}

function InterviewPrepStatLink({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <Link to="/interviews" className="block transition hover:-translate-y-0.5 hover:border-ghost/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost rounded-xl">
      <StatCard label={label} value={value} accent={accent} />
    </Link>
  )
}

export function DashboardPage() {
  const applications = useApplicationsStore((state) => state.applications)
  const skills = useInterviewPrepStore((state) => state.skills)
  const interviewSkills = useMemo(() => Object.values(skills), [skills])

  const appliedCount = applications.filter((app) => app.stage === 'applied').length
  const interviewingCount = applications.filter((app) => INTERVIEW_STAGES.includes(app.stage)).length
  const followUpsDue = applications.filter(
    (app) => !TERMINAL_STAGES.includes(app.stage) && isDue(app.followUpAt),
  ).length
  const trackedSkillsCount = interviewSkills.length
  const overallReadiness = trackedSkillsCount === 0
    ? 0
    : interviewSkills.reduce((sum, skill) => sum + skill.mastery, 0) / trackedSkillsCount
  const technicalReadiness = getAverageMasteryByCategory(interviewSkills, 'technical')
  const behavioralReadiness = getAverageMasteryByCategory(interviewSkills, 'behavioral')
  const architectureReadiness = getAverageMasteryByCategory(interviewSkills, 'architecture')
  // Skills practiced but not yet mastered — the ones to keep drilling.
  const weakTopicsCount = interviewSkills.filter((skill) => skill.attempts > 0 && skill.mastery < MASTERY_THRESHOLD).length

  const funnelSteps = useMemo(() => funnel(applications), [applications])
  const activity = useMemo(() => activityByWeek(applications), [applications])

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader title="Command Center" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <Link
          to="/applications"
          className="block transition hover:-translate-y-0.5 hover:border-ghost/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost rounded-xl"
        >
          <StatCard label="Total Opportunities Tracked" value={applications.length} />
        </Link>
        <StatCard label="Active Applications" value={appliedCount} />
        <StatCard label="Interview Pipeline" value={interviewingCount} accent />
        <Link
          to="/applications"
          className="block transition hover:-translate-y-0.5 hover:border-ghost/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost rounded-xl"
        >
          <StatCard label="Follow-ups Due" value={followUpsDue} />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
        <InterviewPrepStatLink label="Overall Interview Readiness" value={formatPercent(overallReadiness)} accent />
        <InterviewPrepStatLink label="Technical Readiness" value={formatPercent(technicalReadiness)} />
        <InterviewPrepStatLink label="Behavioral Readiness" value={formatPercent(behavioralReadiness)} />
        <InterviewPrepStatLink label="Architecture Readiness" value={formatPercent(architectureReadiness)} />
        <InterviewPrepStatLink label="Weak Topics Needing Review" value={weakTopicsCount} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white uppercase tracking-widest">Pipeline &amp; activity</h2>
        <Link to="/metrics" className="text-sm text-muted hover:text-ink-2">
          View all metrics →
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {applications.length > 0 ? (
          <>
            <ChartCard title="Pipeline funnel" subtitle="Applications reaching each stage.">
              <FunnelChart steps={funnelSteps} />
            </ChartCard>
            <ChartCard title="Activity over time" subtitle="Applications added per week.">
              <ActivityChart weeks={activity} />
            </ChartCard>
          </>
        ) : (
          <Card className="lg:col-span-2 text-sm text-muted">
            Track applications to unlock pipeline and activity analytics.
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-white mb-4">Strategic Directives</h3>
          <ul className="space-y-4">
            <li className="flex gap-3 text-sm text-ink-3">
              <CheckCircle2 size={16} className="text-ghost mt-0.5 shrink-0" aria-hidden />
              <span>Keep focusing on React/Node/Java roles to maximize existing architecture experience.</span>
            </li>
            <li className="flex gap-3 text-sm text-ink-3">
              <CheckCircle2 size={16} className="text-ghost mt-0.5 shrink-0" aria-hidden />
              <span>Update GoMech portfolio to highlight the specific AI models integrated.</span>
            </li>
            <li className="flex gap-3 text-sm text-ink-3">
              <Sparkles size={16} className="text-indigo-400 mt-0.5 shrink-0" aria-hidden />
              <span className="text-ink-2">Run the Analyzer on high-match opportunities in the board.</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
