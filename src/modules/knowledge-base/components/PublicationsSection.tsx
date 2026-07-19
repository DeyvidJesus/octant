import type { FactStatus, KnowledgePublication } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { createId } from '@/utils/id'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES } from '@/constants/knowledge'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

function emptyPublication(): KnowledgePublication {
  return {
    id: createId(),
    title: '',
    venue: '',
    status: 'todo',
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface PublicationsSectionProps {
  publications: KnowledgePublication[]
  onChange: (next: KnowledgePublication[]) => void
  query: string
  statusFilter: 'all' | FactStatus
}

/** Articles, papers, and posts you've published. */
export function PublicationsSection({ publications, onChange, query, statusFilter }: PublicationsSectionProps) {
  return (
    <KnowledgeList
      items={publications}
      onChange={onChange}
      create={emptyPublication}
      addLabel="Add publication"
      emptyHint="No publications yet. Add articles, papers, or posts you've written."
      isVisible={(publication) => {
        if (statusFilter !== 'all' && publication.status !== statusFilter) return false
        return `${publication.title} ${publication.venue}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }}
      itemTitle={(publication) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[publication.status]}>{FACT_STATUS_LABELS[publication.status]}</Badge>
          {publication.title || 'Untitled publication'}
        </span>
      )}
      renderItem={(publication, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Title">
              <Input value={publication.title} onChange={(e) => update({ title: e.target.value })} />
            </Field>
            <Field label="Venue">
              <Input value={publication.venue} onChange={(e) => update({ venue: e.target.value })} />
            </Field>
            <Field label="Status">
              <StatusSelect value={publication.status} onChange={(status) => update({ status })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Date">
              <Input value={publication.date ?? ''} onChange={(e) => update({ date: e.target.value || undefined })} placeholder="2024" />
            </Field>
            <Field label="URL">
              <Input value={publication.url ?? ''} onChange={(e) => update({ url: e.target.value || undefined })} placeholder="https://…" />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={2} value={publication.description ?? ''} onChange={(e) => update({ description: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  )
}
