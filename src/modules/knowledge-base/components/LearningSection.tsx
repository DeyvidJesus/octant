import type { KnowledgeLearningEntry } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { createId } from '@/utils/id'
import { fromDateInput, toDateInput } from '@/utils/dates'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES } from '@/constants/knowledge'
import { learningText } from '@/services/knowledge/search'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

function emptyLearning(): KnowledgeLearningEntry {
  return {
    id: createId(),
    title: '',
    provider: '',
    skillIds: [],
    status: 'todo',
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface LearningSectionProps {
  learning: KnowledgeLearningEntry[]
  onChange: (next: KnowledgeLearningEntry[]) => void
  query: string
}

export function LearningSection({ learning, onChange, query }: LearningSectionProps) {
  return (
    <KnowledgeList
      items={learning}
      onChange={onChange}
      create={emptyLearning}
      addLabel="Add learning entry"
      emptyHint="No learning entries yet. Track courses, certifications, and study you want to surface on resumes."
      isVisible={(l) => learningText(l).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())}
      itemTitle={(l) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[l.status]}>{FACT_STATUS_LABELS[l.status]}</Badge>
          {l.title || 'Untitled entry'}
        </span>
      )}
      renderItem={(entry, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Title">
              <Input value={entry.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label="Provider">
              <Input value={entry.provider} onChange={(e) => update({ provider: e.target.value })} />
            </Field>
            <Field label="Completed on">
              <Input
                type="date"
                value={toDateInput(entry.completedAt)}
                onChange={(e) => update({ completedAt: fromDateInput(e.target.value) })}
              />
            </Field>
            <Field label="Status">
              <StatusSelect value={entry.status} onChange={(status) => update({ status })} />
            </Field>
          </div>
          <Field label="URL">
            <Input value={entry.url ?? ''} placeholder="https://…" onChange={(e) => update({ url: e.target.value || undefined })} />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} value={entry.notes ?? ''} onChange={(e) => update({ notes: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  )
}
