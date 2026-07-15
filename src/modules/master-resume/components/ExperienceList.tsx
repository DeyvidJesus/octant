import type { ExperienceEntry } from '@/types/resume'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { createId } from '@/utils/id'
import { EntityList } from './EntityList'
import { AccomplishmentsEditor } from './AccomplishmentsEditor'

interface ExperienceListProps {
  experience: ExperienceEntry[]
  onChange: (next: ExperienceEntry[]) => void
}

export function ExperienceList({ experience, onChange }: ExperienceListProps) {
  return (
    <EntityList
      items={experience}
      onChange={onChange}
      create={(): ExperienceEntry => ({ id: createId(), company: '', role: '', duration: '', accomplishments: [] })}
      addLabel="Add experience"
      emptyHint="No experience entries yet."
      itemTitle={(item) => [item.role, item.company].filter(Boolean).join(' @ ') || 'New role'}
      renderItem={(item, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company">
              <Input value={item.company} onChange={(e) => update({ company: e.target.value })} />
            </Field>
            <Field label="Role">
              <Input value={item.role} onChange={(e) => update({ role: e.target.value })} />
            </Field>
            <Field label="Duration">
              <Input value={item.duration} placeholder="e.g. June 2024 - Present" onChange={(e) => update({ duration: e.target.value })} />
            </Field>
            <Field label="Location (optional)">
              <Input value={item.location ?? ''} onChange={(e) => update({ location: e.target.value || undefined })} />
            </Field>
          </div>
          <AccomplishmentsEditor
            accomplishments={item.accomplishments}
            onChange={(accomplishments) => update({ accomplishments })}
          />
        </div>
      )}
    />
  )
}
