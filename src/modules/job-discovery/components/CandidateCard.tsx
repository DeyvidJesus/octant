import { useState } from 'react'
import { Check, ChevronDown, ChevronUp, ExternalLink, Sparkles, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'
import type { DiscoveredCandidate } from '@/types/discovery'
import { enrichOneCandidate } from '@/stores/discoveryRunner'
import { formatDate } from '@/utils/dates'

/** Missing must-have skills from the persisted deterministic analysis. */
function missingRequired(candidate: DiscoveredCandidate): string[] {
  return (candidate.analysis?.detectedStack ?? [])
    .filter((skill) => !skill.inResume && skill.importance === 'required')
    .map((skill) => skill.canonical)
}

const ORIGIN_LABELS: Record<DiscoveredCandidate['origin'], string> = {
  paste: 'Pasted report',
  sweep: 'Sweep',
  'deep-research': 'Deep Research',
  agent: 'Discovery agent',
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
  const [enriching, setEnriching] = useState(false)
  const hasDescription = candidate.description.trim().length > 0
  const gaps = missingRequired(candidate)
  const canEnrich = Boolean(candidate.analysis) && candidate.enrichmentStatus !== 'done'

  const handleExplain = async () => {
    setEnriching(true)
    try {
      await enrichOneCandidate(candidate)
    } finally {
      setEnriching(false)
    }
  }

  return (
    <div className={`bg-surface border rounded-xl p-4 transition-colors ${selected ? 'border-edge-2' : 'border-edge'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${candidate.company} — ${candidate.role}`}
          className="mt-1.5 accent-ink-strong"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-ink-strong">{candidate.company}</span>
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
              <Badge tone={candidate.matchScore >= 60 ? 'success' : 'default'}>
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

          {/* Gaps (deterministic) */}
          {gaps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {gaps.slice(0, 5).map((skill) => (
                <Badge key={skill} tone="danger">
                  Missing: {skill}
                </Badge>
              ))}
            </div>
          )}

          {/* Recommendation + grounded explanation (AI enrichment) */}
          {candidate.recommendation && (
            <p className="text-sm text-ink-2 mt-3 flex gap-2 leading-relaxed">
              <Sparkles size={14} className="text-info mt-0.5 shrink-0" aria-hidden />
              <span>{candidate.recommendation}</span>
            </p>
          )}
          {candidate.explanation && expanded && (
            <p className="text-sm text-ink-3 whitespace-pre-wrap leading-relaxed mt-2 border-l-2 border-edge-2 pl-3">
              {candidate.explanation}
            </p>
          )}
          {canEnrich && (
            <button
              type="button"
              onClick={handleExplain}
              disabled={enriching}
              className="text-xs text-info hover:text-info-soft mt-3 inline-flex items-center gap-1 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong rounded"
            >
              {enriching ? <Loader2 size={12} className="animate-spin" aria-hidden /> : <Sparkles size={12} aria-hidden />}
              {enriching ? 'Analysing…' : 'Explain fit'}
            </button>
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
