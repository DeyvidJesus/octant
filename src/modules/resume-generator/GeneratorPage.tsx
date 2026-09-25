import { useNavigate } from 'react-router-dom'
import { Briefcase, FileText, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'
import { useGeneratorStore } from '@/stores/generatorStore'
import { formatDate } from '@/utils/dates'

/**
 * Pick a target: tailoring starts from an analyzed job, best matches first —
 * apply where the odds are highest.
 */
export function GeneratorPage() {
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)
  const tailored = useGeneratorStore((state) => state.tailored)
  const navigate = useNavigate()

  const active = jobs.filter((job) => !job.archived)
  const ranked = [...active].sort(
    (a, b) => (analyses[b.id]?.match.atsScore ?? -1) - (analyses[a.id]?.match.atsScore ?? -1),
  )

  if (active.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No opportunities to tailor for"
        description="A tailored resume starts from a job. Add or discover opportunities first."
        action={
          <Button variant="subtle" onClick={() => navigate('/jobs')}>
            Go to Opportunity Board
          </Button>
        }
      />
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto animate-fade-in">
      <PageHeader
        title="Resume Generator"
        subtitle="One Master Resume, tailored per job: real accomplishments selected and reordered for what each posting asks — nothing invented. Best matches first."
      />

      <div className="space-y-3">
        {ranked.map((job) => {
          const analysis = analyses[job.id]
          const doc = tailored[job.id]
          return (
            <div
              key={job.id}
              className="bg-surface border border-edge rounded-xl p-5 flex items-center gap-4 hover:bg-surface-2 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-ink-strong flex items-center gap-2 flex-wrap">
                  {job.company}
                  <span className="text-muted text-sm font-normal truncate">{job.role}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  {analysis ? (
                    <Badge tone={analysis.match.atsScore >= 60 ? 'success' : 'default'}>
                      ATS {analysis.match.atsScore}%
                    </Badge>
                  ) : (
                    <Badge>not analyzed</Badge>
                  )}
                  {doc && <Badge tone="info">tailored {formatDate(doc.generatedAt)}</Badge>}
                </div>
              </div>

              {analysis ? (
                <Button onClick={() => navigate(`/generator/${job.id}`)}>
                  <FileText size={14} aria-hidden />
                  {doc ? 'Open' : 'Tailor'}
                </Button>
              ) : (
                <Button variant="subtle" onClick={() => navigate(`/jobs/${job.id}/analysis`)}>
                  <ScanSearch size={14} aria-hidden /> Analyze first
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
