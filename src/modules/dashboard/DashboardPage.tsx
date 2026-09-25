import { lazy, Suspense, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { useJobsStore } from '@/stores/jobsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useInterviewPrepStore } from '@/stores/interviewPrepStore'
import type { InterviewQuestionCategory, UserSkill } from '@/types/interviewPrep'
import { MASTERY_THRESHOLD } from '@/services/interviewPrep/mastery'
import { INTERVIEW_STAGES, TERMINAL_STAGES } from '@/constants/applicationStages'
import { isDue } from '@/utils/dates'
import { activityByWeek, funnel } from '@/services/metrics/computeMetrics'
import { ChartCard } from '@/modules/metrics/components/ChartCard'
import { StatCard } from './components/StatCard'

// Recharts is ~110 KB gzipped; lazy-loading keeps it out of every page's modulepreload list.
const FunnelChart = lazy(() =>
  import('@/modules/metrics/components/FunnelChart').then((module) => ({ default: module.FunnelChart })),
)
const ActivityChart = lazy(() =>
  import('@/modules/metrics/components/ActivityChart').then((module) => ({ default: module.ActivityChart })),
)

/** Reserves the chart's height while its chunk loads, so the grid does not jump. */
function ChartPlaceholder({ height }: { height: number }) {
  return <div className="rounded-lg bg-surface-2/40 animate-pulse" style={{ height }} aria-hidden />
}

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

interface NextStep {
  id: string
  text: string
  to: string
  primary?: boolean
}

export function DashboardPage() {
  const applications = useApplicationsStore((state) => state.applications)
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)
  const knowledgeBase = useResumeStore((state) => state.knowledgeBase)
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
  // Skills practiced but not yet mastered.
  const weakTopicsCount = interviewSkills.filter((skill) => skill.attempts > 0 && skill.mastery < MASTERY_THRESHOLD).length

  const funnelSteps = useMemo(() => funnel(applications), [applications])
  const activity = useMemo(() => activityByWeek(applications), [applications])

  // Next steps derived from the user's current data.
  const nextSteps = useMemo<NextStep[]>(() => {
    const steps: NextStep[] = []
    const hasKnowledge = knowledgeBase.facts.length > 0 || knowledgeBase.roles.length > 0
    if (!hasKnowledge) {
      steps.push({ id: 'kb', text: 'Build your Knowledge Base — it powers resumes, matching, and interview prep.', to: '/knowledge', primary: true })
    }
    if (followUpsDue > 0) {
      steps.push({ id: 'followups', text: `Follow up on ${followUpsDue} application${followUpsDue === 1 ? '' : 's'} due now.`, to: '/applications', primary: true })
    }
    if (jobs.length === 0) {
      steps.push({ id: 'jobs', text: 'Let your agent find job opportunities to analyze and track.', to: '/jobs' })
    } else if (Object.keys(analyses).length === 0) {
      steps.push({ id: 'analyze', text: 'Run the Analyzer on your opportunities to see match scores.', to: '/jobs' })
    }
    if (trackedSkillsCount === 0) {
      steps.push({ id: 'prep', text: 'Start an interview prep session to build your readiness.', to: '/interviews' })
    } else if (weakTopicsCount > 0) {
      steps.push({ id: 'weak', text: `Drill ${weakTopicsCount} weak topic${weakTopicsCount === 1 ? '' : 's'} before your next interview.`, to: '/interviews' })
    }
    return steps.slice(0, 4)
  }, [knowledgeBase, jobs, analyses, followUpsDue, trackedSkillsCount, weakTopicsCount])

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
        <Link
          to="/applications"
          className="block transition hover:-translate-y-0.5 hover:border-ghost/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost rounded-xl"
        >
          <StatCard label="Active Applications" value={appliedCount} />
        </Link>
        <Link
          to="/applications"
          className="block transition hover:-translate-y-0.5 hover:border-ghost/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost rounded-xl"
        >
          <StatCard label="Interview Pipeline" value={interviewingCount} accent />
        </Link>
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
        <h2 className="text-sm font-semibold text-ink-strong uppercase tracking-widest">Pipeline &amp; activity</h2>
        <Link to="/metrics" className="text-sm text-muted hover:text-ink-2">
          View all metrics →
        </Link>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {applications.length > 0 ? (
          <>
            <ChartCard title="Pipeline funnel" subtitle="Applications reaching each stage.">
              <Suspense fallback={<ChartPlaceholder height={funnelSteps.length * 44 + 16} />}>
                <FunnelChart steps={funnelSteps} />
              </Suspense>
            </ChartCard>
            <ChartCard title="Activity over time" subtitle="Applications added per week.">
              <Suspense fallback={<ChartPlaceholder height={220} />}>
                <ActivityChart weeks={activity} />
              </Suspense>
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
          <h3 className="text-sm font-medium text-ink-strong mb-4">Recommended next steps</h3>
          {nextSteps.length > 0 ? (
            <ul className="space-y-3">
              {nextSteps.map((step) => (
                <li key={step.id}>
                  <Link
                    to={step.to}
                    className="group flex items-start gap-3 text-sm text-ink-3 hover:text-ink transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong"
                  >
                    {step.primary ? (
                      <Sparkles size={16} className="text-info mt-0.5 shrink-0" aria-hidden />
                    ) : (
                      <CheckCircle2 size={16} className="text-ghost mt-0.5 shrink-0" aria-hidden />
                    )}
                    <span className={step.primary ? 'text-ink-2' : undefined}>{step.text}</span>
                    <ArrowRight size={14} className="ml-auto mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <CheckCircle2 size={16} className="text-success shrink-0" aria-hidden />
              You're all caught up — nothing needs your attention right now.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
