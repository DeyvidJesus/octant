import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Briefcase,
  CheckCircle2,
  FileSearch,
  Loader2,
  Star,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { getAnalyzer } from '@/services/analysis/localHeuristicAnalyzer'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'
import { DetectedRequirements } from './components/DetectedRequirements'
import { MatchReportView } from './components/MatchReportView'
import { GapReport } from './components/GapReport'

type SectionId = 'requirements' | 'match' | 'gaps'

const SECTIONS: Array<{ id: SectionId; title: string; icon: LucideIcon }> = [
  { id: 'requirements', title: 'Detected Requirements', icon: FileSearch },
  { id: 'match', title: 'Match Report', icon: Star },
  { id: 'gaps', title: 'Gaps & Strengths', icon: AlertCircle },
]

export function JobAnalysisPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const job = useJobsStore((state) => state.jobs.find((j) => j.id === jobId))
  const analysis = useJobsStore((state) => (jobId ? state.analyses[jobId] : undefined))
  const saveAnalysis = useJobsStore((state) => state.saveAnalysis)
  const resume = useResumeStore((state) => state.resume)
  const upsertApplication = useApplicationsStore((state) => state.upsertApplication)

  const [activeSection, setActiveSection] = useState<SectionId>('requirements')
  const [running, setRunning] = useState(false)
  const autoRan = useRef(false)

  const runAnalysis = async () => {
    if (!job) return
    setRunning(true)
    try {
      const result = await getAnalyzer().analyze({ job, resume })
      saveAnalysis(result)
      setActiveSection('requirements')
    } finally {
      setRunning(false)
    }
  }

  // Analysis is instant, local, and non-destructive — run it automatically the
  // first time an unanalyzed job is opened so there's no extra click. Re-runs
  // stay explicit via the "Re-run" button.
  useEffect(() => {
    if (job && !analysis && !autoRan.current) {
      autoRan.current = true
      void runAnalysis()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, analysis])

  if (!job) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Opportunity not found"
        description="This job may have been removed."
        action={
          <Button variant="subtle" onClick={() => navigate('/jobs')}>
            Back to Opportunity Board
          </Button>
        }
      />
    )
  }

  const saveToTracker = () => {
    upsertApplication({
      id: createId(),
      jobId: job.id,
      company: job.company,
      role: job.role,
      salary: job.salaryRange,
      location: job.location,
      workMode: job.workMode,
      stage: 'saved',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      links: job.url ? [{ label: 'Job posting', url: job.url }] : [],
      notes: '',
      matchScore: analysis?.match.atsScore,
    })
    navigate('/applications')
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full animate-fade-in">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-surface border border-edge-2 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <Loader2 size={32} className={`text-white ${running ? 'animate-spin' : ''}`} aria-hidden />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">
            {running ? 'Analyzing…' : 'Job Analyzer'}
          </h2>
          <p className="text-muted text-sm mb-8 leading-relaxed">
            {running ? (
              <>Matching <strong className="text-ink-2">{job.company} — {job.role}</strong> against your Master Resume.</>
            ) : (
              <>Analyze <strong className="text-ink-2">{job.company} — {job.role}</strong> against your Master Resume: detected stack, seniority signals, keyword match, and gaps. Runs entirely on your device — deterministic, no invented experience.</>
            )}
          </p>
          {!running && (
            <Button className="w-full py-3 rounded-xl shadow-[0_0_20px_rgba(255,255,255,0.1)]" onClick={runAnalysis}>
              Run Analysis
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full animate-fade-in">
      <div className="w-64 border-r border-edge bg-base overflow-y-auto custom-scrollbar py-6 shrink-0">
        <div className="px-6 mb-6">
          <div className="text-xs text-faint font-semibold uppercase tracking-widest mb-1">Target</div>
          <div className="text-white font-medium truncate">{job.company}</div>
          <div className="text-muted text-xs truncate">{job.role}</div>
        </div>

        <nav aria-label="Analysis sections" className="space-y-1 px-3">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              aria-current={activeSection === section.id}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition border ${
                activeSection === section.id
                  ? 'bg-surface-2 text-white border-edge-2'
                  : 'text-muted hover:text-ink-2 border-transparent'
              }`}
            >
              <section.icon size={14} className={activeSection === section.id ? 'text-white' : 'text-[#555]'} aria-hidden />
              <span className="truncate">{section.title}</span>
            </button>
          ))}
        </nav>

        <div className="px-6 mt-8 pt-6 border-t border-edge space-y-3">
          <Button variant="accent" className="w-full" onClick={saveToTracker}>
            <CheckCircle2 size={14} aria-hidden /> Save to Tracker
          </Button>
          <Button variant="ghost" className="w-full" onClick={runAnalysis} disabled={running}>
            {running ? 'Analyzing…' : 'Re-run Analysis'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-base">
        <div className="max-w-3xl animate-rise-in" key={activeSection}>
          <h2 className="text-2xl font-semibold text-white mb-6">
            {SECTIONS.find((section) => section.id === activeSection)?.title}
          </h2>
          {activeSection === 'requirements' && <DetectedRequirements analysis={analysis} />}
          {activeSection === 'match' && <MatchReportView match={analysis.match} />}
          {activeSection === 'gaps' && <GapReport analysis={analysis} />}
        </div>
      </div>
    </div>
  )
}
