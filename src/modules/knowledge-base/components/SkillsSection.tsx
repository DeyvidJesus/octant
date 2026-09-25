import type { KnowledgeSkill } from '@/types/resume'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createId } from '@/utils/id'
import { KnowledgeList } from './KnowledgeList'

function emptySkill(): KnowledgeSkill {
  return {
    id: createId(),
    canonical: '',
    category: '',
    evidenceFactIds: [],
    provenance: { source: 'manual', excerpt: '' },
  }
}

const numeric = (value: string): number | undefined => (value === '' ? undefined : Number(value))

interface SkillsSectionProps {
  skills: KnowledgeSkill[]
  onChange: (next: KnowledgeSkill[]) => void
  query: string
}

/** The skill taxonomy that resume tailoring and job-match scoring draw from. */
export function SkillsSection({ skills, onChange, query }: SkillsSectionProps) {
  return (
    <KnowledgeList
      items={skills}
      onChange={onChange}
      create={emptySkill}
      addLabel="Add skill"
      emptyHint="No skills yet. Add the technologies and capabilities you want matched against job descriptions."
      isVisible={(skill) =>
        `${skill.canonical} ${skill.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
      }
      itemTitle={(skill) => (
        <span className="flex items-center gap-2">
          {skill.favorite && <span className="text-warning" aria-label="Favorite">★</span>}
          {skill.canonical || 'Untitled skill'}
          {skill.category && <span className="text-faint">· {skill.category}</span>}
        </span>
      )}
      renderItem={(skill, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <Input value={skill.canonical} onChange={(e) => update({ canonical: e.target.value })} />
            </Field>
            <Field label="Category">
              <Input value={skill.category} onChange={(e) => update({ category: e.target.value })} placeholder="Frontend, Backend, …" />
            </Field>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Proficiency">
              <Select
                value={skill.proficiency ?? ''}
                onChange={(e) => update({ proficiency: e.target.value === '' ? undefined : (Number(e.target.value) as KnowledgeSkill['proficiency']) })}
              >
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </Select>
            </Field>
            <Field label="Years used">
              <Input type="number" value={skill.yearsUsed ?? ''} onChange={(e) => update({ yearsUsed: numeric(e.target.value) })} />
            </Field>
            <Field label="Last used">
              <Input type="number" value={skill.lastUsedYear ?? ''} onChange={(e) => update({ lastUsedYear: numeric(e.target.value) })} />
            </Field>
            <Field label="Favorite">
              <label className="flex items-center gap-2 h-9 text-sm text-ink-2">
                <input type="checkbox" checked={skill.favorite ?? false} onChange={(e) => update({ favorite: e.target.checked || undefined })} />
                Highlight
              </label>
            </Field>
          </div>
        </div>
      )}
    />
  )
}
