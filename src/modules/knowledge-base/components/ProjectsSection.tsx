import type { Initiative, InitiativeType } from '@/types/resume'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createId } from '@/utils/id'
import { KnowledgeList } from './KnowledgeList'

const INITIATIVE_TYPES: { value: InitiativeType; label: string }[] = [
  { value: 'employment_project', label: 'Employment project' },
  { value: 'freelance_engagement', label: 'Freelance engagement' },
  { value: 'portfolio_project', label: 'Portfolio project' },
  { value: 'other', label: 'Other' },
]

function emptyInitiative(): Initiative {
  return {
    id: createId(),
    name: '',
    type: 'portfolio_project',
    roleIds: [],
    technologySkillIds: [],
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface ProjectsSectionProps {
  initiatives: Initiative[]
  onChange: (next: Initiative[]) => void
  query: string
}

/** Projects and engagements (initiatives). Confirmed facts tagged to one become its resume bullets. */
export function ProjectsSection({ initiatives, onChange, query }: ProjectsSectionProps) {
  return (
    <KnowledgeList
      items={initiatives}
      onChange={onChange}
      create={emptyInitiative}
      addLabel="Add project"
      emptyHint="No projects yet. Add employment projects, freelance engagements, or portfolio work."
      isVisible={(initiative) =>
        `${initiative.name} ${initiative.description ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }
      itemTitle={(initiative) => initiative.name || 'Untitled project'}
      renderItem={(initiative, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={initiative.name} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label="Type">
              <Select value={initiative.type} onChange={(e) => update({ type: e.target.value as InitiativeType })}>
                {INITIATIVE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description">
            <Textarea rows={2} value={initiative.description ?? ''} onChange={(e) => update({ description: e.target.value || undefined })} />
          </Field>
          <Field label="URL">
            <Input value={initiative.url ?? ''} onChange={(e) => update({ url: e.target.value || undefined })} placeholder="https://…" />
          </Field>
        </div>
      )}
    />
  )
}
