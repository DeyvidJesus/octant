import type { CareerFact, FactStatus, FactType } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { TagInput } from '@/components/ui/TagInput'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES, FACT_TYPES, FACT_TYPE_LABELS } from '@/constants/knowledge'
import { emptyFact } from '@/services/knowledge/classify'
import { factText } from '@/services/knowledge/search'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

interface FactsSectionProps {
  facts: CareerFact[]
  onChange: (next: CareerFact[]) => void
  query: string
  statusFilter: 'all' | FactStatus
}

export function FactsSection({ facts, onChange, query, statusFilter }: FactsSectionProps) {
  return (
    <KnowledgeList
      items={facts}
      onChange={onChange}
      create={emptyFact}
      addLabel="Add fact"
      emptyHint="No facts yet. Facts are the atomic career claims that power resume tailoring and interview prep."
      isVisible={(fact) => {
        if (statusFilter !== 'all' && fact.status !== statusFilter) return false
        return factText(fact).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }}
      itemTitle={(fact) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[fact.status]}>{FACT_STATUS_LABELS[fact.status]}</Badge>
          {FACT_TYPE_LABELS[fact.type]}
          {fact.statement && <span className="text-muted truncate max-w-xs hidden sm:inline">— {fact.statement}</span>}
        </span>
      )}
      renderItem={(fact, update) => (
        <div className="space-y-3">
          <Field label="Statement">
            <Textarea rows={2} value={fact.statement} onChange={(e) => update({ statement: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={fact.type} onChange={(e) => update({ type: e.target.value as FactType })}>
                {FACT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {FACT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <StatusSelect value={fact.status} onChange={(status) => update({ status })} />
            </Field>
          </div>
          <Field label="Tags">
            <TagInput ariaLabel="Fact tags" values={fact.tags} onChange={(tags) => update({ tags })} />
          </Field>
        </div>
      )}
    />
  )
}
