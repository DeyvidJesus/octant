import type { Credential, CredentialType, FactStatus } from '@/types/resume'
import { Badge } from '@/components/ui/Badge'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createId } from '@/utils/id'
import { FACT_STATUS_LABELS, FACT_STATUS_TONES } from '@/constants/knowledge'
import { KnowledgeList } from './KnowledgeList'
import { StatusSelect } from './StatusSelect'

const CREDENTIAL_TYPES: { value: CredentialType; label: string }[] = [
  { value: 'certification', label: 'Certification' },
  { value: 'education', label: 'Education' },
]

function emptyCredential(): Credential {
  return {
    id: createId(),
    type: 'certification',
    name: '',
    status: 'todo',
    provenance: { source: 'manual', excerpt: '' },
  }
}

interface CredentialsSectionProps {
  credentials: Credential[]
  onChange: (next: Credential[]) => void
  query: string
  statusFilter: 'all' | FactStatus
}

/** Certifications and education (one table, split by `type`). */
export function CredentialsSection({ credentials, onChange, query, statusFilter }: CredentialsSectionProps) {
  const optional = (value: string) => value || undefined
  return (
    <KnowledgeList
      items={credentials}
      onChange={onChange}
      create={emptyCredential}
      addLabel="Add credential"
      emptyHint="No credentials yet. Add certifications and degrees."
      isVisible={(credential) => {
        if (statusFilter !== 'all' && credential.status !== statusFilter) return false
        return `${credential.name} ${credential.issuer ?? ''} ${credential.field ?? ''}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())
      }}
      itemTitle={(credential) => (
        <span className="flex items-center gap-2">
          <Badge tone={FACT_STATUS_TONES[credential.status]}>{FACT_STATUS_LABELS[credential.status]}</Badge>
          {credential.name || 'Untitled credential'}
          <span className="text-faint">· {credential.type}</span>
        </span>
      )}
      renderItem={(credential, update) => (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={credential.type} onChange={(e) => update({ type: e.target.value as CredentialType })}>
                {CREDENTIAL_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <StatusSelect value={credential.status} onChange={(status) => update({ status })} />
            </Field>
            <Field label={credential.type === 'education' ? 'Degree' : 'Name'}>
              <Input value={credential.name} onChange={(e) => update({ name: e.target.value })} />
            </Field>
            <Field label={credential.type === 'education' ? 'Institution' : 'Issuer'}>
              <Input value={credential.issuer ?? ''} onChange={(e) => update({ issuer: optional(e.target.value) })} />
            </Field>
            <Field label="Field">
              <Input value={credential.field ?? ''} onChange={(e) => update({ field: optional(e.target.value) })} />
            </Field>
            <Field label="Credential ID">
              <Input value={credential.credentialId ?? ''} onChange={(e) => update({ credentialId: optional(e.target.value) })} />
            </Field>
            <Field label="Start">
              <Input value={credential.start ?? ''} onChange={(e) => update({ start: optional(e.target.value) })} placeholder="2019" />
            </Field>
            <Field label="End">
              <Input value={credential.end ?? ''} onChange={(e) => update({ end: optional(e.target.value) })} placeholder="2023" />
            </Field>
            <Field label="Issued at">
              <Input value={credential.issuedAt ?? ''} onChange={(e) => update({ issuedAt: optional(e.target.value) })} />
            </Field>
            <Field label="Expires at">
              <Input value={credential.expiresAt ?? ''} onChange={(e) => update({ expiresAt: optional(e.target.value) })} />
            </Field>
          </div>
          <Field label="URL">
            <Input value={credential.url ?? ''} onChange={(e) => update({ url: optional(e.target.value) })} placeholder="https://…" />
          </Field>
          <Field label="Notes">
            <Textarea rows={2} value={credential.notes ?? ''} onChange={(e) => update({ notes: optional(e.target.value) })} />
          </Field>
        </div>
      )}
    />
  )
}
