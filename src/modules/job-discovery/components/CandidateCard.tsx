import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'
import type { DiscoveredCandidate } from '@/types/discovery'
import { formatDate } from '@/utils/dates'

const ORIGIN_LABELS: Record<DiscoveredCandidate['origin'], string> = {
  paste: 'Pasted report',
  sweep: 'Sweep',
  'deep-research': 'Deep Research',
}

interface CandidateCardProps {
  candidate: DiscoveredCandidate
  selected: boolean
  onToggleSelect: () => void
  onApprove: () => void
  onDismiss: () => void
}

export function CandidateCard({ candidate, selected, onToggleSelect, onApprove, onDismiss }: CandidateCardProps) {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = candidate.description.trim().length > 0

  return (
    <div className={`bg-surface border rounded-xl p-4 transition-colors ${selected ? 'border-edge-2' : 'border-edge'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${candidate.company} — ${candidate.role}`}
          className="mt-1.5 accent-white"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white">{candidate.company}</span>
            <span className="text-muted text-sm truncate">{candidate.role}</span>
            {candidate.url && (
              <a
                href={candidate.url}
                target="_blank"
                rel="noreferrer"
                className="text-faint hover:text-ink-2"
                aria-label={`Open ${candidate.company} job posting`}
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {candidate.matchScore !== undefined ? (
              <Badge tone={candidate.matchScore >= 60 ? 'emerald' : 'default'}>
                ATS {candidate.matchScore}%
              </Badge>
            ) : (
              <Badge>thin description — score after adding the full JD</Badge>
            )}
            {candidate.location && <Badge>{candidate.location}</Badge>}
            {candidate.salaryRange && <Badge>{candidate.salaryRange}</Badge>}
            {candidate.workMode !== 'unknown' && <Badge>{candidate.workMode}</Badge>}
          </div>

          {hasDescription && (
            <>
              <p className={`text-ink-3 text-sm leading-relaxed mt-3 ${expanded ? '' : 'line-clamp-2'}`}>
                {candidate.description}
              </p>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                className="text-xs text-muted hover:text-ink-2 mt-1 inline-flex items-center gap-1"
              >
                {expanded ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
                {expanded ? 'Less' : 'More'}
              </button>
            </>
          )}

          <div className="text-[11px] text-faint mt-2">
            {ORIGIN_LABELS[candidate.origin]} · {candidate.sourceNote} · {formatDate(candidate.foundAt)}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <IconButton icon={Check} label="Approve — add to board" onClick={onApprove} />
          <IconButton icon={X} label="Dismiss" tone="danger" onClick={onDismiss} />
        </div>
      </div>
    </div>
  )
}
