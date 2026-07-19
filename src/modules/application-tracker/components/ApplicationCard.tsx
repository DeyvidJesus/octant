import { useNavigate } from 'react-router-dom'
import { CalendarClock, Star } from 'lucide-react'
import type { Application } from '@/types/application'
import { formatRelative, isOverdue } from '@/utils/dates'
import { StagePill } from './StagePill'

interface ApplicationCardProps {
  application: Application
  /** When true, renders a compact, draggable board card; otherwise a wider row. */
  compact?: boolean
  onDragStart?: (event: React.DragEvent) => void
}

export function ApplicationCard({ application, compact = false, onDragStart }: ApplicationCardProps) {
  const navigate = useNavigate()
  const open = () => navigate(`/applications/${application.id}/edit`)
  const overdue = isOverdue(application.followUpAt)

  return (
    <div
      draggable={compact}
      onDragStart={onDragStart}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
      role="button"
      tabIndex={0}
      className={`bg-[#0d0d0d] border border-edge rounded-xl hover:bg-surface transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {application.priority && <Star size={13} className="text-amber-400 shrink-0" aria-label="Priority" />}
            <h3 className="text-white font-medium truncate">{application.company}</h3>
          </div>
          <p className="text-muted text-sm truncate">{application.role}</p>
        </div>
        {application.matchScore !== undefined && (
          <span className="text-xs text-faint shrink-0">Match {application.matchScore}%</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mt-3">
        <StagePill stage={application.stage} />
        {application.followUpAt && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${overdue ? 'text-red-400' : 'text-faint'}`}
            title="Next follow-up"
          >
            <CalendarClock size={12} aria-hidden />
            {formatRelative(application.followUpAt)}
          </span>
        )}
      </div>
    </div>
  )
}
