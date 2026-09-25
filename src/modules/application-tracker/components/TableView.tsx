import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { Application, ApplicationStage } from '@/types/application'
import { Select } from '@/components/ui/Select'
import { Field } from '@/components/ui/Field'
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'
import { formatRelative, isOverdue } from '@/utils/dates'
import { StagePill } from './StagePill'

type SortKey = 'updated' | 'followUp' | 'company'
type StageFilter = ApplicationStage | 'all'

export function TableView({ applications }: { applications: Application[] }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState<SortKey>('updated')
  const [stageFilter, setStageFilter] = useState<StageFilter>('all')

  const rows = useMemo(() => {
    const filtered =
      stageFilter === 'all' ? applications : applications.filter((app) => app.stage === stageFilter)
    return [...filtered].sort((a, b) => compareBy(a, b, sort))
  }, [applications, stageFilter, sort])

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4">
        <Field label="Filter by stage" className="w-48">
          <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as StageFilter)}>
            <option value="all">All stages</option>
            {APPLICATION_STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {APPLICATION_STAGE_LABELS[stage]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sort by" className="w-48">
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="updated">Recently updated</option>
            <option value="followUp">Next follow-up</option>
            <option value="company">Company (A–Z)</option>
          </Select>
        </Field>
      </div>

      <div className="overflow-x-auto rounded-xl border border-edge">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-faint border-b border-edge">
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Stage</th>
              <th className="px-4 py-3 font-semibold">Next follow-up</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((application) => {
              const overdue = isOverdue(application.followUpAt)
              return (
                <tr
                  key={application.id}
                  onClick={() => navigate(`/applications/${application.id}/edit`)}
                  className="border-b border-edge/60 last:border-0 hover:bg-surface cursor-pointer"
                >
                  <td className="px-4 py-3 text-ink-strong">
                    <span className="inline-flex items-center gap-1.5">
                      {application.priority && <Star size={13} className="text-warning" aria-label="Priority" />}
                      {/* The row click is a mouse shortcut; this link is the keyboard/screen-reader path. */}
                      <Link
                        to={`/applications/${application.id}/edit`}
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong"
                      >
                        {application.company}
                      </Link>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{application.role}</td>
                  <td className="px-4 py-3">
                    <StagePill stage={application.stage} />
                  </td>
                  <td className={`px-4 py-3 ${overdue ? 'text-danger' : 'text-muted'}`}>
                    {application.followUpAt ? formatRelative(application.followUpAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-faint">{formatRelative(application.updatedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function compareBy(a: Application, b: Application, sort: SortKey): number {
  switch (sort) {
    case 'company':
      return a.company.localeCompare(b.company, undefined, { sensitivity: 'base' })
    case 'followUp': {
      // Applications with a follow-up date sort first, earliest due at the top.
      if (!a.followUpAt && !b.followUpAt) return 0
      if (!a.followUpAt) return 1
      if (!b.followUpAt) return -1
      return a.followUpAt.localeCompare(b.followUpAt)
    }
    case 'updated':
    default:
      return b.updatedAt.localeCompare(a.updatedAt)
  }
}
