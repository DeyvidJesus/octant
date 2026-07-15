import type { Certification, Education, Language } from '@/types/resume'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { createId } from '@/utils/id'
import { EntityList } from './EntityList'

export function CertificationsEditor({
  certifications,
  onChange,
}: {
  certifications: Certification[]
  onChange: (next: Certification[]) => void
}) {
  return (
    <EntityList
      items={certifications}
      onChange={onChange}
      create={(): Certification => ({ id: createId(), name: '', issuer: '' })}
      addLabel="Add certification"
      emptyHint="No certifications yet."
      itemTitle={(item) => item.name || 'New certification'}
      renderItem={(item, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Name">
            <Input value={item.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Issuer">
            <Input value={item.issuer} onChange={(e) => update({ issuer: e.target.value })} />
          </Field>
          <Field label="Issued (optional)">
            <Input value={item.issuedAt ?? ''} placeholder="e.g. 2025" onChange={(e) => update({ issuedAt: e.target.value || undefined })} />
          </Field>
          <Field label="Expires (optional)">
            <Input value={item.expiresAt ?? ''} onChange={(e) => update({ expiresAt: e.target.value || undefined })} />
          </Field>
          <Field label="Credential ID (optional)">
            <Input value={item.credentialId ?? ''} onChange={(e) => update({ credentialId: e.target.value || undefined })} />
          </Field>
          <Field label="URL (optional)">
            <Input value={item.url ?? ''} onChange={(e) => update({ url: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  )
}

export function EducationEditor({
  education,
  onChange,
}: {
  education: Education[]
  onChange: (next: Education[]) => void
}) {
  return (
    <EntityList
      items={education}
      onChange={onChange}
      create={(): Education => ({ id: createId(), institution: '', degree: '', field: '' })}
      addLabel="Add education"
      emptyHint="No education entries yet."
      itemTitle={(item) => [item.degree, item.institution].filter(Boolean).join(' — ') || 'New entry'}
      renderItem={(item, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Institution">
            <Input value={item.institution} onChange={(e) => update({ institution: e.target.value })} />
          </Field>
          <Field label="Degree">
            <Input value={item.degree} onChange={(e) => update({ degree: e.target.value })} />
          </Field>
          <Field label="Field">
            <Input value={item.field} onChange={(e) => update({ field: e.target.value })} />
          </Field>
          <Field label="Start (optional)">
            <Input value={item.start ?? ''} onChange={(e) => update({ start: e.target.value || undefined })} />
          </Field>
          <Field label="End (optional)">
            <Input value={item.end ?? ''} onChange={(e) => update({ end: e.target.value || undefined })} />
          </Field>
        </div>
      )}
    />
  )
}

export function LanguagesEditor({
  languages,
  onChange,
}: {
  languages: Language[]
  onChange: (next: Language[]) => void
}) {
  return (
    <EntityList
      items={languages}
      onChange={onChange}
      create={(): Language => ({ id: createId(), name: '', level: '' })}
      addLabel="Add language"
      emptyHint="No languages yet."
      itemTitle={(item) => [item.name, item.level].filter(Boolean).join(' — ') || 'New language'}
      renderItem={(item, update) => (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Language">
            <Input value={item.name} onChange={(e) => update({ name: e.target.value })} />
          </Field>
          <Field label="Level">
            <Input value={item.level} placeholder="e.g. C1, Native" onChange={(e) => update({ level: e.target.value })} />
          </Field>
        </div>
      )}
    />
  )
}
