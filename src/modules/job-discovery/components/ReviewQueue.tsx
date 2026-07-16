import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Inbox, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { approveCandidates } from '../approveCandidates'
import { CandidateCard } from './CandidateCard'

/**
 * The triage surface: discovered jobs never reach the board without an
 * explicit approve here. Quality over quantity, enforced by flow.
 */
export function ReviewQueue() {
  const candidates = useDiscoveryStore((state) => state.candidates)
  const dismissCandidates = useDiscoveryStore((state) => state.dismissCandidates)
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = (ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }

  const approveOne = (id: string) => {
    const candidate = candidates.find((c) => c.id === id)
    if (!candidate) return
    const [job] = approveCandidates([candidate])
    clearSelection([id])
    navigate(`/jobs/${job.id}/analysis`)
  }

  const approveSelected = () => {
    const chosen = candidates.filter((c) => selectedIds.has(c.id))
    if (chosen.length === 0) return
    approveCandidates(chosen)
    clearSelection(chosen.map((c) => c.id))
  }

  const dismissSelected = () => {
    const ids = candidates.filter((c) => selectedIds.has(c.id)).map((c) => c.id)
    if (ids.length === 0) return
    dismissCandidates(ids)
    clearSelection(ids)
  }

  if (candidates.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-edge rounded-xl">
        <Inbox size={28} className="text-edge-2 mx-auto mb-3" aria-hidden />
        <p className="text-sm text-muted">
          The review queue is empty. Import or discover jobs above — they land here for triage.
        </p>
      </div>
    )
  }

  const allSelected = selectedIds.size === candidates.length
  const selectedCount = candidates.filter((c) => selectedIds.has(c.id)).length

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <SectionLabel>Review Queue ({candidates.length})</SectionLabel>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setSelectedIds(allSelected ? new Set() : new Set(candidates.map((c) => c.id)))}
          >
            {allSelected ? 'Clear selection' : 'Select all'}
          </Button>
          <Button variant="accent" disabled={selectedCount === 0} onClick={approveSelected}>
            <Check size={14} aria-hidden /> Approve ({selectedCount})
          </Button>
          <Button
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            disabled={selectedCount === 0}
            onClick={dismissSelected}
          >
            <X size={14} aria-hidden /> Dismiss ({selectedCount})
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {candidates.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            selected={selectedIds.has(candidate.id)}
            onToggleSelect={() => toggle(candidate.id)}
            onApprove={() => approveOne(candidate.id)}
            onDismiss={() => {
              dismissCandidates([candidate.id])
              clearSelection([candidate.id])
            }}
          />
        ))}
      </div>
    </div>
  )
}
