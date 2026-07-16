import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Briefcase, CheckCircle2, FileSearch, MessageSquare, Star } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'

export function InterviewPrepPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const activeJobId = searchParams.get('jobId') ?? undefined
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)

  const activeJob = activeJobId ? jobs.find((job) => job.id === activeJobId) : undefined
  const activeAnalysis = activeJobId ? analyses[activeJobId] : undefined
  const analyzedJobs = jobs.filter((job) => analyses[job.id])

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

  if (!activeAnalysis || !activeJob) {
    return (
      <div className="p-8 max-w-5xl mx-auto animate-fade-in">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-surface border border-edge-2 flex items-center justify-center mb-4">
            <MessageSquare className="text-white" size={24} aria-hidden />
          </div>
          <h1 className="text-3xl font-semibold text-white">Interview Preparation</h1>
          <p className="text-muted mt-2 max-w-2xl">
            Select an analyzed opportunity to prepare with job-specific stack, gap, and ATS context.
            Jobs without analysis need to be analyzed first.
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
                      <div className="text-white font-medium">{job.company} — {job.role}</div>
                      <div className="text-xs text-muted mt-1">
                        {analysis.detectedStack.length} stack signals · {analysis.match.missing.length} gaps · ATS {analysis.match.atsScore}%
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

  return (
    <div className="p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-faint font-semibold uppercase tracking-widest mb-2">Active prep context</div>
          <h1 className="text-3xl font-semibold text-white">{activeJob.company} — {activeJob.role}</h1>
          <p className="text-muted mt-2 max-w-2xl">
            Prep is scoped to this job's detected stack, resume gaps, and ATS keywords from the latest analysis.
          </p>
        </div>
        <Button variant="subtle" onClick={() => navigate('/interviews')}>
          Change Context
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-edge rounded-xl p-5">
          <Star size={18} className="text-white mb-3" aria-hidden />
          <div className="text-2xl font-semibold text-white">{activeAnalysis.match.atsScore}%</div>
          <div className="text-xs text-muted mt-1">ATS match score</div>
        </div>
        <div className="bg-surface border border-edge rounded-xl p-5">
          <CheckCircle2 size={18} className="text-emerald-500 mb-3" aria-hidden />
          <div className="text-2xl font-semibold text-white">{activeAnalysis.match.matched.length}</div>
          <div className="text-xs text-muted mt-1">Matched signals to emphasize</div>
        </div>
        <div className="bg-surface border border-edge rounded-xl p-5">
          <AlertCircle size={18} className="text-amber-500 mb-3" aria-hidden />
          <div className="text-2xl font-semibold text-white">{activeAnalysis.match.missing.length}</div>
          <div className="text-xs text-muted mt-1">Missing gaps to address honestly</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-surface border border-edge rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Stack-focused prompts</h2>
          <div className="flex flex-wrap gap-2">
            {activeAnalysis.detectedStack.map((skill) => (
              <Badge key={`${skill.canonical}-${skill.term}`} tone={skill.inResume ? 'emerald' : 'red'}>
                {skill.canonical}
              </Badge>
            ))}
          </div>
        </section>
        <section className="bg-surface border border-edge rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Gap talking points</h2>
          {activeAnalysis.match.missing.length > 0 ? (
            <ul className="space-y-2 text-sm text-muted">
              {activeAnalysis.match.missing.map((gap) => (
                <li key={gap}>• Prepare an honest bridge for <span className="text-ink-2">{gap}</span>.</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No missing skills detected. Prepare concise examples for your matched strengths.</p>
          )}
        </section>
      </div>
    </div>
  )
}
