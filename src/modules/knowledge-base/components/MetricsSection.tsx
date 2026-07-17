import type { Metric } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createId } from '@/utils/id'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES } from '@/constants/knowledge'
import { metricText } from '@/services/knowledge/search'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

function emptyMetric(): Metric {
  return {
    id: createId(),
    statement: '',
    kind: 'numeric',
    factIds: [],
    status: 'todo',
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface MetricsSectionProps {
  metrics: Metric[]
  onChange: (next: Metric[]) => void
  query: string
}

export function MetricsSection({ metrics, onChange, query }: MetricsSectionProps) {
  return (
    <KnowledgeList
      items={metrics}
      onChange={onChange}
      create={emptyMetric}
      addLabel="Add metric"
      emptyHint="No metrics yet. Capture quantified outcomes (e.g. 'cut p95 latency 40%') to strengthen resume bullets."
      isVisible={(m) => metricText(m).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())}
      itemTitle={(m) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[m.status]}>{FACT_STATUS_LABELS[m.status]}</Badge>
          {m.statement || 'Untitled metric'}
        </span>
      )}
      renderItem={(metric, update) => (
        <div className="space-y-3">
          <Field label="Statement">
            <Input value={metric.statement} onChange={(e) => update({ statement: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Kind">
              <Select value={metric.kind} onChange={(e) => update({ kind: e.target.value as Metric['kind'] })}>
                <option value="numeric">Numeric</option>
                <option value="qualitative">Qualitative</option>
              </Select>
            </Field>
            <Field label="Value">
              <Input
                type="number"
                value={metric.value ?? ''}
                onChange={(e) => update({ value: e.target.value === '' ? undefined : Number(e.target.value) })}
              />
            </Field>
            <Field label="Unit">
              <Input value={metric.unit ?? ''} onChange={(e) => update({ unit: e.target.value || undefined })} />
            </Field>
            <Field label="Status">
              <StatusSelect value={metric.status} onChange={(status) => update({ status })} />
            </Field>
          </div>
          <Field label="Baseline">
            <Input value={metric.baseline ?? ''} onChange={(e) => update({ baseline: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  )
}
