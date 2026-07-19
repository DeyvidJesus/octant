import type { CareerProfile, Language, PersonalInfo } from '@/types/resume'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { TagInput } from '@/components/ui/TagInput'
import { createId } from '@/utils/id'
import { KnowledgeList } from './KnowledgeList'

function emptyLanguage(): Language {
  return { id: createId(), name: '', level: '' }
}

interface ProfileSectionProps {
  profile: CareerProfile
  onChange: (profile: CareerProfile) => void
}

/** Editor for the single career profile: identity, summary, values, and languages. */
export function ProfileSection({ profile, onChange }: ProfileSectionProps) {
  const patch = (next: Partial<CareerProfile>) => onChange({ ...profile, ...next })
  const patchPersonal = (next: Partial<PersonalInfo>) =>
    onChange({ ...profile, personal: { ...profile.personal, ...next } })
  const optional = (value: string) => value || undefined

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Name">
          <Input value={profile.personal.name} onChange={(e) => patchPersonal({ name: e.target.value })} />
        </Field>
        <Field label="Role">
          <Input value={profile.personal.role} onChange={(e) => patchPersonal({ role: e.target.value })} />
        </Field>
        <Field label="Location">
          <Input value={profile.personal.location} onChange={(e) => patchPersonal({ location: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input value={profile.personal.email ?? ''} onChange={(e) => patchPersonal({ email: optional(e.target.value) })} />
        </Field>
        <Field label="Phone">
          <Input value={profile.personal.phone ?? ''} onChange={(e) => patchPersonal({ phone: optional(e.target.value) })} />
        </Field>
        <Field label="Website">
          <Input value={profile.personal.website ?? ''} onChange={(e) => patchPersonal({ website: optional(e.target.value) })} />
        </Field>
        <Field label="GitHub">
          <Input value={profile.personal.github ?? ''} onChange={(e) => patchPersonal({ github: optional(e.target.value) })} />
        </Field>
        <Field label="LinkedIn">
          <Input value={profile.personal.linkedin ?? ''} onChange={(e) => patchPersonal({ linkedin: optional(e.target.value) })} />
        </Field>
        <Field label="Timezone">
          <Input value={profile.personal.timezone ?? ''} onChange={(e) => patchPersonal({ timezone: optional(e.target.value) })} />
        </Field>
        <Field label="Work authorization">
          <Input value={profile.personal.workAuthorization ?? ''} onChange={(e) => patchPersonal({ workAuthorization: optional(e.target.value) })} />
        </Field>
      </div>

      <Field label="Summary">
        <Textarea rows={3} value={profile.summary} onChange={(e) => patch({ summary: e.target.value })} />
      </Field>
      <Field label="Career direction">
        <Textarea rows={2} value={profile.careerDirection} onChange={(e) => patch({ careerDirection: e.target.value })} />
      </Field>
      <Field label="Philosophy">
        <Textarea rows={2} value={profile.philosophy ?? ''} onChange={(e) => patch({ philosophy: optional(e.target.value) })} />
      </Field>
      <Field label="Values">
        <TagInput ariaLabel="Values" values={profile.values} onChange={(values) => patch({ values })} />
      </Field>
      <Field label="Work preferences">
        <TagInput ariaLabel="Work preferences" values={profile.workPreferences} onChange={(workPreferences) => patch({ workPreferences })} />
      </Field>

      <div>
        <h3 className="text-sm font-medium text-ink-2 mb-2">Languages</h3>
        <KnowledgeList
          items={profile.languages}
          onChange={(languages) => patch({ languages })}
          create={emptyLanguage}
          addLabel="Add language"
          emptyHint="No languages yet."
          itemTitle={(language) => language.name || 'Untitled language'}
          renderItem={(language, update) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Language">
                <Input value={language.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field label="Level">
                <Input value={language.level} onChange={(e) => update({ level: e.target.value })} placeholder="Native, C1, …" />
              </Field>
            </div>
          )}
        />
      </div>
    </div>
  )
}
