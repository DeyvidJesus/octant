import { Input, Textarea } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { TagInput } from '@/components/ui/TagInput'
import type { MasterResume, PersonalInfo } from '@/types/resume'

interface ProfileCardProps {
  resume: MasterResume
  onChange: (patch: Partial<MasterResume>) => void
}

export function ProfileCard({ resume, onChange }: ProfileCardProps) {
  const setPersonal = (patch: Partial<PersonalInfo>) =>
    onChange({ personal: { ...resume.personal, ...patch } })

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Field label="Full Name">
          <Input value={resume.personal.name} onChange={(e) => setPersonal({ name: e.target.value })} />
        </Field>
        <Field label="Current Role">
          <Input value={resume.personal.role} onChange={(e) => setPersonal({ role: e.target.value })} />
        </Field>
        <Field label="Location">
          <Input value={resume.personal.location} onChange={(e) => setPersonal({ location: e.target.value })} />
        </Field>
        <Field label="Timezone">
          <Input value={resume.personal.timezone ?? ''} onChange={(e) => setPersonal({ timezone: e.target.value || undefined })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={resume.personal.email ?? ''} onChange={(e) => setPersonal({ email: e.target.value || undefined })} />
        </Field>
        <Field label="Phone">
          <Input value={resume.personal.phone ?? ''} onChange={(e) => setPersonal({ phone: e.target.value || undefined })} />
        </Field>
        <Field label="Website">
          <Input value={resume.personal.website ?? ''} onChange={(e) => setPersonal({ website: e.target.value || undefined })} />
        </Field>
        <Field label="GitHub">
          <Input value={resume.personal.github ?? ''} onChange={(e) => setPersonal({ github: e.target.value || undefined })} />
        </Field>
        <Field label="LinkedIn">
          <Input value={resume.personal.linkedin ?? ''} onChange={(e) => setPersonal({ linkedin: e.target.value || undefined })} />
        </Field>
        <Field label="Work Authorization">
          <Input value={resume.personal.workAuthorization ?? ''} onChange={(e) => setPersonal({ workAuthorization: e.target.value || undefined })} />
        </Field>
      </div>

      <Field label="Professional Summary" className="mb-4">
        <Textarea rows={4} value={resume.summary} onChange={(e) => onChange({ summary: e.target.value })} />
      </Field>
      <Field label="Career Goals" className="mb-4">
        <Textarea rows={3} value={resume.goals} onChange={(e) => onChange({ goals: e.target.value })} />
      </Field>
      <Field label="Engineering Values">
        <TagInput ariaLabel="Engineering values" values={resume.values} onChange={(values) => onChange({ values })} />
      </Field>
    </>
  )
}
