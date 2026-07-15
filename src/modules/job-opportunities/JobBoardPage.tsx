import { useNavigate } from 'react-router-dom'
import { ScanSearch, Briefcase, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'

export function JobBoardPage() {
  const jobs = useJobsStore((state) => state.jobs)
  const analyses = useJobsStore((state) => state.analyses)
  const navigate = useNavigate()

  const activeJobs = jobs.filter((job) => !job.archived)

  if (activeJobs.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No opportunities yet"
        description="Adding opportunities with pasted job descriptions arrives in an upcoming increment."
      />
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader
        title="Opportunity Board"
        subtitle="Tracked roles. Run the analyzer to match any of them against your Master Resume."
      />

      <div className="bg-surface border border-edge rounded-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-edge bg-base">
              <th scope="col" className="px-6 py-4 text-xs font-semibold text-faint uppercase tracking-wider">
                Company & Role
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold text-faint uppercase tracking-wider">
                Description
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold text-faint uppercase tracking-wider">
                Salary / Match
              </th>
              <th scope="col" className="px-6 py-4 text-xs font-semibold text-faint uppercase tracking-wider text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {activeJobs.map((job) => {
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
                    <div className="text-sm text-ink-2 truncate max-w-[250px]">{job.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-ink-2">{job.salaryRange ?? '—'}</div>
                    <div className="text-xs text-faint mt-0.5">
                      {analysis ? `ATS match: ${analysis.match.atsScore}%` : 'Not analyzed yet'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button variant="subtle" onClick={() => navigate(`/jobs/${job.id}/analysis`)}>
                      <ScanSearch size={14} aria-hidden /> Analyze
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
