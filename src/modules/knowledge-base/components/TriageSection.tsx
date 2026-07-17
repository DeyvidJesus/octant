import { useState } from 'react'
import { ArrowRight, Trash2 } from 'lucide-react'
import type { FactType, UnclassifiedFact } from '@/types/resume'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { FACT_TYPES, FACT_TYPE_LABELS } from '@/constants/knowledge'
import { unclassifiedText } from '@/services/knowledge/search'

interface TriageSectionProps {
  items: UnclassifiedFact[]
  query: string
  onClassify: (item: UnclassifiedFact, type: FactType) => void
  onDismiss: (id: string) => void
}

export function TriageSection({ items, query, onClassify, onDismiss }: TriageSectionProps) {
  const visible = items.filter((item) =>
    unclassifiedText(item).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  )

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        Triage inbox is empty. Raw notes the importer can't classify land here for review.
      </p>
    )
  }
  if (visible.length === 0) {
    return <p className="text-sm text-muted">No inbox items match your search.</p>
  }

  return (
    <div className="space-y-4">
      {visible.map((item) => (
        <TriageCard key={item.id} item={item} onClassify={onClassify} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function TriageCard({
  item,
  onClassify,
  onDismiss,
}: {
  item: UnclassifiedFact
  onClassify: (item: UnclassifiedFact, type: FactType) => void
  onDismiss: (id: string) => void
}) {
  const [type, setType] = useState<FactType>('achievement')

  return (
    <div className="border border-edge rounded-lg p-4 bg-base space-y-3">
      <p className="text-sm text-ink-2">{item.rawText}</p>
      <div className="text-xs text-faint">
        Source: {item.source} · {item.reason}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Classify as" className="w-56">
          <Select value={type} onChange={(e) => setType(e.target.value as FactType)}>
            {FACT_TYPES.map((factType) => (
              <option key={factType} value={factType}>
                {FACT_TYPE_LABELS[factType]}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={() => onClassify(item, type)}>
          <ArrowRight size={14} aria-hidden /> Promote to fact
        </Button>
        <Button variant="ghost" onClick={() => onDismiss(item.id)}>
          <Trash2 size={14} aria-hidden /> Dismiss
        </Button>
      </div>
    </div>
  )
}
