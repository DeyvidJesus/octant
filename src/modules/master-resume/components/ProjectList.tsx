import type { ProjectEntry } from '@/types/resume'
import { Input, Textarea } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { EntityList } from './EntityList'
import { AccomplishmentsEditor } from './AccomplishmentsEditor'

interface ProjectListProps {
  projects: ProjectEntry[]
  onChange: (next: ProjectEntry[]) => void
}

export function ProjectList({ projects, onChange }: ProjectListProps) {
  return (
    <EntityList
      items={projects}
      onChange={onChange}
      create={(): ProjectEntry => ({ id: createId(), name: '', tech: [], description: '', accomplishments: [] })}
      addLabel="Add project"
      emptyHint="No projects yet."
      itemTitle={(item) => item.name || 'New project'}
      renderItem={(item, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={item.name} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="URL (optional)">
              <Input value={item.url ?? ''} onChange={(e) => update({ url: e.target.value || undefined })} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={2} value={item.description} onChange={(e) => update({ description: e.target.value })} />
          </Field>
          <Field label="Tech stack">
            <TagInput ariaLabel="Tech stack" values={item.tech} onChange={(tech) => update({ tech })} />
          </Field>
          <AccomplishmentsEditor
            accomplishments={item.accomplishments}
            onChange={(accomplishments) => update({ accomplishments })}
          />
        </div>
      )}
    />
  )
}
