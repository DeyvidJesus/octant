import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Briefcase, FileSearch, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useInterviewPrepStore } from '@/stores/interviewPrepStore'
import { generatePrep } from '@/services/interviewPrep/generatePrep'
import type { InterviewQuestionCategory, PrepQuestion } from '@/types/interviewPrep'
import type { MasterResume } from '@/types/resume'
import { QuestionCard } from './components/QuestionCard'

const CATEGORY_ORDER: InterviewQuestionCategory[] = ['technical', 'behavioral', 'architecture']

const CATEGORY_LABEL: Record<InterviewQuestionCategory, string> = {
  technical: 'Technical & stack',
  behavioral: 'Behavioral (STAR)',
  architecture: 'System design',
}

function buildResumeEvidence(resume: MasterResume): string[] {
  const evidence: string[] = []
  for (const story of resume.stories) {
    if (story.title && story.result) evidence.push(`${story.title}: ${story.result}`)
  }
  for (const entry of resume.experience) {
    for (const accomplishment of entry.accomplishments) {
      if (accomplishment.text) evidence.push(accomplishment.text)
    }
  }
  return evidence.slice(0, 12)
}

export function InterviewPrepPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeJobId = searchParams.get('jobId') ?? undefined
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)
  const knowledgeBase = useResumeStore((state) => state.knowledgeBase)
  const resume = useResumeStore((state) => state.resume)
  const tracked = useInterviewPrepStore((state) => state.tracked)

  const activeJob = activeJobId ? jobs.find((job) => job.id === activeJobId) : undefined
  const activeAnalysis = activeJobId ? analyses[activeJobId] : undefined
  const analyzedJobs = jobs.filter((job) => analyses[job.id])

  const plan = useMemo(
    () => (activeJob && activeAnalysis ? generatePrep(knowledgeBase, activeJob, activeAnalysis) : null),
    [knowledgeBase, activeJob, activeAnalysis],
  )
  const resumeEvidence = useMemo(() => buildResumeEvidence(resume), [resume])

  if (activeJobId && !activeJob) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Interview context not found"
        description="This interview prep link points to an opportunity that no longer exists. Choose another analyzed job to prepare with its context."
        action={
          <Button variant="subtle" onClick={() => navigate('/interviews', { replace: true })}>
            Clear job context
          </Button>
        }
      />
    )
  }

  if (activeJob && !activeAnalysis) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Analyze this job before interview prep"
        description="Interview Prep depends on the job analysis detected stack, missing match gaps, and ATS keyword data. Run analysis first, then return to prepare with this job context."
        action={
          <Button onClick={() => navigate(`/jobs/${activeJob.id}/analysis`)}>
            <FileSearch size={16} aria-hidden /> Analyze Job First
          </Button>
        }
      />
    )
  }

  if (!activeAnalysis || !activeJob || !plan) {
    return (
      <div className="p-8 max-w-5xl mx-auto animate-fade-in">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-edge-2 flex items-center justify-center mb-4">
            <MessageSquare className="text-white" size={24} aria-hidden />
          </div>
          <h1 className="text-3xl font-semibold text-white">Interview Preparation</h1>
          <p className="text-muted mt-2 max-w-2xl">
            Select an analyzed opportunity to generate targeted technical, behavioral, and system-design
            questions with model answers and an AI practice coach. Jobs without analysis need to be
            analyzed first.
          </p>
        </div>

        {analyzedJobs.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No analyzed jobs yet"
            description="Interview Prep depends on JobAnalysis.detectedStack, match.missing, and ATS data. Analyze a job first to unlock targeted prep."
            action={<Button onClick={() => navigate('/jobs')}>Go to Opportunity Board</Button>}
          />
        ) : (
          <div className="grid gap-3">
            {analyzedJobs.map((job) => {
              const analysis = analyses[job.id]
              return (
                <Link
                  key={job.id}
                  to={`/interviews?jobId=${encodeURIComponent(job.id)}`}
                  className="block bg-surface border border-edge rounded-xl p-5 hover:bg-surface-2 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-white font-medium">
                        {job.company} — {job.role}
                      </div>
                      <div className="text-xs text-muted mt-1">
                        {analysis.detectedStack.length} stack signals · {analysis.match.missing.length} gaps · ATS{' '}
                        {analysis.match.atsScore}%
                      </div>
                    </div>
                    <Badge tone="emerald">Analyzed</Badge>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const questionsByCategory = groupByCategory(plan.topics.flatMap((topic) => topic.questions))
  const missingSkills = activeAnalysis.match.missing

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-faint font-semibold uppercase tracking-widest mb-2">Active prep context</div>
          <h1 className="text-3xl font-semibold text-white">
            {activeJob.company} — {activeJob.role}
          </h1>
          <p className="text-muted mt-2 max-w-2xl">
            Questions are ranked by this job's detected stack and resume gaps. Rate your confidence to
            build readiness, or practice an answer with the AI coach.
          </p>
        </div>
        <Button variant="subtle" onClick={() => navigate('/interviews')}>
          Change Context
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        {CATEGORY_ORDER.map((category) => {
          const questions = questionsByCategory[category] ?? []
          const readiness = categoryReadiness(questions, tracked)
          return (
            <div key={category} className="bg-surface border border-edge rounded-xl p-5">
              <div className="text-xs text-faint font-semibold uppercase tracking-widest mb-2">
                {CATEGORY_LABEL[category]}
              </div>
              <div className="text-2xl font-semibold text-white">{readiness}%</div>
              <div className="text-xs text-muted mt-1">{questions.length} questions</div>
            </div>
          )
        })}
      </div>

      <div className="space-y-10">
        {CATEGORY_ORDER.map((category) => {
          const questions = questionsByCategory[category] ?? []
          if (questions.length === 0) return null
          return (
            <section key={category}>
              <h2 className="text-lg font-semibold text-white mb-4">{CATEGORY_LABEL[category]}</h2>
              <div className="space-y-4">
                {questions.map((question) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    job={activeJob}
                    resume={resume}
                    resumeEvidence={resumeEvidence}
                    missingSkills={missingSkills}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function groupByCategory(questions: PrepQuestion[]): Record<InterviewQuestionCategory, PrepQuestion[]> {
  const grouped: Record<InterviewQuestionCategory, PrepQuestion[]> = {
    technical: [],
    behavioral: [],
    architecture: [],
  }
  for (const question of questions) grouped[question.category].push(question)
  return grouped
}

function categoryReadiness(
  questions: PrepQuestion[],
  tracked: Record<string, { confidence: number }>,
): number {
  if (questions.length === 0) return 0
  const total = questions.reduce((sum, question) => sum + (tracked[question.id]?.confidence ?? 0), 0)
  return Math.round(total / questions.length)
}
