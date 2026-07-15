import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanSearch, Briefcase, ExternalLink, Plus, Pencil, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'

export function JobBoardPage() {
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)
  const updateJob = useJobsStore((state) => state.updateJob)
  const removeJob = useJobsStore((state) => state.removeJob)
  const navigate = useNavigate()
  const [showArchived, setShowArchived] = useState(false)

  const visibleJobs = jobs.filter((job) => job.archived === showArchived)
  const archivedCount = jobs.filter((job) => job.archived).length

  const addButton = (
    <Button onClick={() => navigate('/jobs/new')}>
      <Plus size={16} aria-hidden /> Add Opportunity
    </Button>
  )

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No opportunities yet"
        description="Add a job by pasting its description, then analyze it against your Master Resume."
        action={addButton}
      />
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        title="Opportunity Board"
        subtitle="Paste real job descriptions and analyze how you match against your Master Resume."
        actions={addButton}
      />

      {archivedCount > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowArchived((prev) => !prev)}
            className="text-xs text-muted hover:text-ink-2 inline-flex items-center gap-1.5"
          >
            <Archive size={12} aria-hidden />
            {showArchived ? `Showing archived (${archivedCount}) · view active` : `Show archived (${archivedCount})`}
          </button>
        </div>
      )}

      {visibleJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={showArchived ? 'No archived opportunities' : 'No active opportunities'}
          description={showArchived ? 'Nothing archived yet.' : 'Add one to get started.'}
          action={showArchived ? undefined : addButton}
        />
      ) : (
        <div className="bg-surface border border-edge rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-edge bg-base">
                <th scope="col" className="px-6 py-4 text-xs font-semibold text-faint uppercase tracking-wider">Company & Role</th>
                <th scope="col" className="px-6 py-4 text-xs font-semibold text-faint uppercase tracking-wider">Salary / Match</th>
                <th scope="col" className="px-6 py-4 text-xs font-semibold text-faint uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {visibleJobs.map((job) => {
                const analysis = analyses[job.id]
                return (
                  <tr key={job.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-white flex items-center gap-2">
                        {job.company}
                        {job.url && (
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-faint hover:text-ink-2"
                            aria-label={`Open ${job.company} job posting`}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {job.role}
                        {job.category ? ` • ${job.category}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-ink-2">{job.salaryRange ?? '—'}</div>
                      <div className="text-xs text-faint mt-0.5">
                        {analysis ? `ATS match: ${analysis.match.atsScore}%` : 'Not analyzed yet'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="subtle" onClick={() => navigate(`/jobs/${job.id}/analysis`)}>
                          <ScanSearch size={14} aria-hidden /> Analyze
                        </Button>
                        <IconButton icon={Pencil} label="Edit" onClick={() => navigate(`/jobs/${job.id}/edit`)} />
                        <IconButton
                          icon={job.archived ? ArchiveRestore : Archive}
                          label={job.archived ? 'Unarchive' : 'Archive'}
                          onClick={() => updateJob(job.id, { archived: !job.archived })}
                        />
                        <IconButton
                          icon={Trash2}
                          label="Delete"
                          tone="danger"
                          onClick={() => {
                            if (window.confirm(`Delete ${job.company} — ${job.role}? This also removes its analysis.`)) {
                              removeJob(job.id)
                            }
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
