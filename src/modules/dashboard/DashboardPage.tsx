import { Link } from 'react-router-dom'
import { CheckCircle2, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { useInterviewPrepStore, type InterviewQuestionCategory } from '@/stores/interviewPrepStore'
import { INTERVIEW_STAGES } from '@/constants/applicationStages'
import { StatCard } from './components/StatCard'

const REVIEW_STATUSES = new Set(['need_review', 'review_tomorrow', 'review_next_week'])

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function getAverageConfidenceByCategory(
  questions: ReturnType<typeof useInterviewPrepStore.getState>['questions'],
  category: InterviewQuestionCategory,
) {
  const categoryQuestions = questions.filter((question) => question.category === category)
  if (categoryQuestions.length === 0) return 0

  const totalConfidence = categoryQuestions.reduce((sum, question) => sum + (question.confidence ?? 0), 0)
  return (totalConfidence / categoryQuestions.length) * 100
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
  const interviewQuestions = useInterviewPrepStore((state) => state.questions)

  const appliedCount = applications.filter((app) => app.stage === 'applied').length
  const interviewingCount = applications.filter((app) => INTERVIEW_STAGES.includes(app.stage)).length
  const trackedQuestionsCount = interviewQuestions.length
  const masteredQuestionsCount = interviewQuestions.filter((question) => question.mastered || question.status === 'mastered').length
  const overallReadiness = trackedQuestionsCount === 0 ? 0 : (masteredQuestionsCount / trackedQuestionsCount) * 100
  const technicalReadiness = getAverageConfidenceByCategory(interviewQuestions, 'technical')
  const behavioralReadiness = getAverageConfidenceByCategory(interviewQuestions, 'behavioral')
  const architectureReadiness = getAverageConfidenceByCategory(interviewQuestions, 'architecture')
  const weakTopicsCount = interviewQuestions.filter((question) => question.status && REVIEW_STATUSES.has(question.status)).length

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader title="Command Center" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Total Opportunities Tracked" value={applications.length} />
        <StatCard label="Active Applications" value={appliedCount} />
        <StatCard label="Interview Pipeline" value={interviewingCount} accent />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6 mb-8">
        <InterviewPrepStatLink label="Overall Interview Readiness" value={formatPercent(overallReadiness)} accent />
        <InterviewPrepStatLink label="Technical Readiness" value={formatPercent(technicalReadiness)} />
        <InterviewPrepStatLink label="Behavioral Readiness" value={formatPercent(behavioralReadiness)} />
        <InterviewPrepStatLink label="Architecture Readiness" value={formatPercent(architectureReadiness)} />
        <InterviewPrepStatLink label="Weak Topics Needing Review" value={weakTopicsCount} />
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
