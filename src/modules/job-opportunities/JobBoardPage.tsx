import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ScanSearch, Briefcase, ExternalLink, Plus, Pencil, Archive, ArchiveRestore, Trash2, MessageSquare, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { confirm } from '@/stores/confirmStore'
import { FREE_LIMITS, jobLimitReached } from '@/constants/plan'
import { AgentStatusHeader } from '@/modules/job-discovery/components/AgentStatusHeader'
import { ReviewQueue } from '@/modules/job-discovery/components/ReviewQueue'

export function JobBoardPage() {
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)
  const updateJob = useJobsStore((state) => state.updateJob)
  const removeJob = useJobsStore((state) => state.removeJob)
  const navigate = useNavigate()
  const tier = useSubscriptionStore((state) => state.tier)
  const [showArchived, setShowArchived] = useState(false)

  const visibleJobs = jobs.filter((job) => job.archived === showArchived)
  const archivedCount = jobs.filter((job) => job.archived).length
  // RLS counts every row, so the cap is on the total (archived included).
  const atJobLimit = jobLimitReached(tier, jobs.length)

  const addButton = atJobLimit ? (
    <Button
      onClick={() => navigate('/settings')}
      title={`The Free plan is limited to ${FREE_LIMITS.jobs} opportunities. Upgrade to Pro for unlimited.`}
    >
      <Crown size={16} aria-hidden /> Upgrade to add more
    </Button>
  ) : (
    <Button variant="subtle" onClick={() => navigate('/jobs/new')}>
      <Plus size={16} aria-hidden /> Add manually
    </Button>
  )

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        title="Opportunities"
        subtitle="Your agent finds and ranks openings against your profile. Review what it surfaces and approve the ones worth pursuing."
        actions={addButton}
      />

      {/* The one button: run the agent; discovered opportunities render below, streaming in. */}
      <div className="mb-6">
        <AgentStatusHeader />
      </div>
      <ReviewQueue />

      {/* Opportunities you approved / added — tracked on your board. */}
      <div className="mt-12">
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Your board</SectionLabel>
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((prev) => !prev)}
              className="text-xs text-muted hover:text-ink-2 inline-flex items-center gap-1.5"
            >
              <Archive size={12} aria-hidden />
              {showArchived ? `Showing archived (${archivedCount}) · view active` : `Show archived (${archivedCount})`}
            </button>
          )}
        </div>

        {visibleJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={showArchived ? 'No archived opportunities' : 'No opportunities on your board yet'}
            description={
              showArchived
                ? 'Nothing archived yet.'
                : 'Approve an opportunity above, or add one manually, to track and analyze it here.'
            }
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
                        <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                          <span>
                            {job.role}
                            {job.category ? ` • ${job.category}` : ''}
                          </span>
                          {job.source !== 'manual' && (
                            <Badge tone="indigo" className="py-0.5! text-[10px]">
                              {job.source}
                            </Badge>
                          )}
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
                          {analysis ? (
                            <Button variant="subtle" onClick={() => navigate(`/interviews?jobId=${encodeURIComponent(job.id)}`)}>
                              <MessageSquare size={14} aria-hidden /> Prepare for interview
                            </Button>
                          ) : (
                            <Button
                              variant="subtle"
                              title="Analyze this job first; Interview Prep depends on detected stack, missing gaps, and ATS data."
                              onClick={() => navigate(`/jobs/${job.id}/analysis`)}
                            >
                              <ScanSearch size={14} aria-hidden /> Analyze first
                            </Button>
                          )}
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
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Delete opportunity?',
                                message: `Delete ${job.company} — ${job.role}? This also removes its analysis.`,
                                confirmLabel: 'Delete',
                                tone: 'danger',
                              })
                              if (ok) removeJob(job.id)
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
    </div>
  )
}
