import type { FactStatus, TechnicalDecision } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES } from '@/constants/knowledge'
import { decisionText } from '@/services/knowledge/search'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

function emptyDecision(): TechnicalDecision {
  return {
    id: createId(),
    context: '',
    selectedApproach: '',
    rationale: '',
    optionsConsidered: [],
    tradeoffs: [],
    outcome: '',
    roleIds: [],
    initiativeIds: [],
    factIds: [],
    status: 'todo',
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface DecisionsSectionProps {
  decisions: TechnicalDecision[]
  onChange: (next: TechnicalDecision[]) => void
  query: string
  statusFilter: 'all' | FactStatus
}

export function DecisionsSection({ decisions, onChange, query, statusFilter }: DecisionsSectionProps) {
  return (
    <KnowledgeList
      items={decisions}
      onChange={onChange}
      create={emptyDecision}
      addLabel="Add decision"
      emptyHint="No technical decisions yet. Record architecture/tech choices as lightweight ADRs — context, options, tradeoffs, outcome."
      isVisible={(d) => {
        if (statusFilter !== 'all' && d.status !== statusFilter) return false
        return decisionText(d).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }}
      itemTitle={(d) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[d.status]}>{FACT_STATUS_LABELS[d.status]}</Badge>
          {d.selectedApproach || 'Untitled decision'}
        </span>
      )}
      renderItem={(decision, update) => (
        <div className="space-y-3">
          <Field label="Context">
            <Textarea rows={2} value={decision.context} onChange={(e) => update({ context: e.target.value })} />
          </Field>
          <Field label="Selected approach">
            <Input value={decision.selectedApproach} onChange={(e) => update({ selectedApproach: e.target.value })} />
          </Field>
          <Field label="Rationale">
            <Textarea rows={2} value={decision.rationale ?? ''} onChange={(e) => update({ rationale: e.target.value })} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Options considered">
              <TagInput
                ariaLabel="Options considered"
                values={decision.optionsConsidered}
                onChange={(optionsConsidered) => update({ optionsConsidered })}
              />
            </Field>
            <Field label="Tradeoffs">
              <TagInput ariaLabel="Tradeoffs" values={decision.tradeoffs} onChange={(tradeoffs) => update({ tradeoffs })} />
            </Field>
          </div>
          <Field label="Outcome">
            <Textarea rows={2} value={decision.outcome ?? ''} onChange={(e) => update({ outcome: e.target.value })} />
          </Field>
          <Field label="Status">
            <StatusSelect value={decision.status} onChange={(status) => update({ status })} />
          </Field>
        </div>
      )}
    />
  )
}
