import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardCopy, FileText, Printer, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useGeneratorStore } from '@/stores/generatorStore'
import { getAnalyzer } from '@/services/analysis/localHeuristicAnalyzer'
import { generateTailoredResume } from '@/services/generator/generate'
import { computeCoverage } from '@/services/generator/coverage'
import { toMarkdown, toPlainText } from '@/services/generator/markdown'
import { CoverageMeter } from './components/CoverageMeter'
import { ResumePaper } from './components/ResumePaper'

export function GeneratorEditorPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()

  const job = useJobsStore((state) => state.jobs.find((j) => j.id === jobId))
  const analysis = useJobsStore((state) => (jobId ? state.analyses[jobId] : undefined))
  const saveAnalysis = useJobsStore((state) => state.saveAnalysis)
  const resume = useResumeStore((state) => state.resume)
  const tailored = useGeneratorStore((state) => (jobId ? state.tailored[jobId] : undefined))
  const saveTailored = useGeneratorStore((state) => state.saveTailored)
  const toggleBullet = useGeneratorStore((state) => state.toggleBullet)
  const toggleProject = useGeneratorStore((state) => state.toggleProject)

  const [copied, setCopied] = useState<string | null>(null)
  const bootstrapped = useRef(false)

  // Bootstrap: analyze (local, instant) if needed, then generate if needed.
  // Both are deterministic and non-destructive, so no confirmation required.
  useEffect(() => {
    if (!job || bootstrapped.current) return
    bootstrapped.current = true
    void (async () => {
      let current = analysis
      if (!current) {
        current = await getAnalyzer().analyze({ job, resume })
        saveAnalysis(current)
      }
      if (!tailored) {
        saveTailored(generateTailoredResume(resume, current))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job])

  const coverage = useMemo(
    () => (tailored && analysis ? computeCoverage(tailored, analysis) : null),
    [tailored, analysis],
  )

  if (!job) {
    return (
      <EmptyState
        icon={FileText}
        title="Opportunity not found"
        description="This job may have been removed."
        action={
          <Button variant="subtle" onClick={() => navigate('/generator')}>
            Back to Resume Generator
          </Button>
        }
      />
    )
  }

  if (!tailored) {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm animate-fade-in">
        Generating from your Master Resume…
      </div>
    )
  }

  const stale = tailored.resumeUpdatedAt !== resume.updatedAt

  const regenerate = () => {
    if (analysis) saveTailored(generateTailoredResume(resume, analysis))
  }

  const copy = async (label: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="flex h-full animate-fade-in print:h-auto print:block">
      {/* Controls — never printed */}
      <div className="w-80 border-r border-edge bg-base overflow-y-auto custom-scrollbar p-6 shrink-0 space-y-8 print:hidden">
        <div>
          <button
            onClick={() => navigate('/generator')}
            className="text-xs text-muted hover:text-ink-2 inline-flex items-center gap-1 mb-4"
          >
            <ArrowLeft size={12} aria-hidden /> All tailored resumes
          </button>
          <div className="text-xs text-faint font-semibold uppercase tracking-widest mb-1">Tailored for</div>
          <div className="text-white font-medium">{job.company}</div>
          <div className="text-muted text-xs">{job.role}</div>
        </div>

        {coverage && <CoverageMeter coverage={coverage} />}

        {stale && (
          <p className="text-xs text-amber-400/90 leading-relaxed">
            Your Master Resume changed since this was generated. Regenerate to pick up the latest
            content (your bullet selections will reset).
          </p>
        )}

        <div className="space-y-2">
          <Button className="w-full" onClick={() => window.print()}>
            <Printer size={14} aria-hidden /> Print / Save as PDF
          </Button>
          <Button variant="subtle" className="w-full" onClick={() => copy('markdown', toMarkdown(tailored))}>
            <ClipboardCopy size={14} aria-hidden />
            {copied === 'markdown' ? 'Copied!' : 'Copy as Markdown'}
          </Button>
          <Button variant="subtle" className="w-full" onClick={() => copy('text', toPlainText(tailored))}>
            <ClipboardCopy size={14} aria-hidden />
            {copied === 'text' ? 'Copied!' : 'Copy as plain text'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={regenerate}>
            <RefreshCw size={14} aria-hidden /> Regenerate
          </Button>
        </div>

        <p className="text-[11px] text-faint leading-relaxed border-t border-edge pt-4">
          Every line is selected from your Master Resume — nothing is invented. Untick any bullet
          to trim the document; the coverage meter updates live. Bold skills match this job
          description.
        </p>
      </div>

      {/* Paper preview — the only thing that prints */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-10 bg-[#0a0a0a] print:overflow-visible print:p-0 print:bg-white">
        <ResumePaper tailored={tailored} onToggleBullet={handleToggle} onToggleProject={handleToggleProject} />
      </div>
    </div>
  )

  function handleToggle(accomplishmentId: string) {
    if (jobId) toggleBullet(jobId, accomplishmentId)
  }

  function handleToggleProject(projectId: string) {
    if (jobId) toggleProject(jobId, projectId)
  }
}
