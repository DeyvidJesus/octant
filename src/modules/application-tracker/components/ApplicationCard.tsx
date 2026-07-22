import { useNavigate } from 'react-router-dom'
import { CalendarClock, Star } from 'lucide-react'
import type { Application } from '@/types/application'
import { APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'
import { formatRelative, isOverdue } from '@/utils/dates'
import { StagePill } from './StagePill'

interface ApplicationCardProps {
  application: Application
  /** When true, renders a compact, draggable board card; otherwise a wider row. */
  compact?: boolean
  onDragStart?: (event: React.DragEvent) => void
  /** Keyboard stage movement on the board (←/→). Provided only in the board view. */
  onMoveLeft?: () => void
  onMoveRight?: () => void
}

export function ApplicationCard({ application, compact = false, onDragStart, onMoveLeft, onMoveRight }: ApplicationCardProps) {
  const navigate = useNavigate()
  const open = () => navigate(`/applications/${application.id}/edit`)
  const overdue = isOverdue(application.followUpAt)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    } else if (e.key === 'ArrowRight' && onMoveRight) {
      e.preventDefault()
      onMoveRight()
    } else if (e.key === 'ArrowLeft' && onMoveLeft) {
      e.preventDefault()
      onMoveLeft()
    }
  }

  const movable = Boolean(onMoveLeft || onMoveRight)

  return (
    <div
      draggable={compact}
      onDragStart={onDragStart}
      onClick={open}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`${application.company} — ${application.role}, stage ${APPLICATION_STAGE_LABELS[application.stage]}.${
        movable ? ' Press Enter to open; use left and right arrow keys to change stage.' : ' Press Enter to open.'
      }`}
      className={`bg-surface border border-edge rounded-xl hover:bg-surface-2 transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ghost ${
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
