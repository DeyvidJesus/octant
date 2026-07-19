import type { Organization, Role } from '@/types/resume'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { createId } from '@/utils/id'
import { KnowledgeList } from './KnowledgeList'

const ORGANIZATION_TYPES: Organization['type'][] = ['employer', 'client', 'personal', 'other']

function emptyOrganization(): Organization {
  return { id: createId(), name: '', type: 'employer', provenance: { source: 'manual', excerpt: '' } }
}

const matches = (haystack: string, query: string) =>
  haystack.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())

interface ExperienceSectionProps {
  organizations: Organization[]
  roles: Role[]
  onChangeOrganizations: (next: Organization[]) => void
  onChangeRoles: (next: Role[]) => void
  query: string
}

/**
 * Organizations and the roles held at them. Roles carry a foreign key to an organization, edited
 * here via a dropdown — so add the organization first, then the role.
 */
export function ExperienceSection({
  organizations,
  roles,
  onChangeOrganizations,
  onChangeRoles,
  query,
}: ExperienceSectionProps) {
  const organizationName = (id: string) => organizations.find((org) => org.id === id)?.name ?? 'No organization'

  const emptyRole = (): Role => ({
    id: createId(),
    organizationId: organizations[0]?.id ?? '',
    title: '',
    period: '',
    provenance: { source: 'manual', excerpt: '' },
  })

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium text-ink-2 mb-2">Organizations</h3>
        <KnowledgeList
          items={organizations}
          onChange={onChangeOrganizations}
          create={emptyOrganization}
          addLabel="Add organization"
          emptyHint="No organizations yet. Add the companies and clients you've worked with; roles link to them."
          isVisible={(org) => matches(org.name, query)}
          itemTitle={(org) => org.name || 'Untitled organization'}
          renderItem={(org, update) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Name">
                <Input value={org.name} onChange={(e) => update({ name: e.target.value })} />
              </Field>
              <Field label="Type">
                <Select value={org.type ?? 'employer'} onChange={(e) => update({ type: e.target.value as Organization['type'] })}>
                  {ORGANIZATION_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        />
      </div>

      <div>
        <h3 className="text-sm font-medium text-ink-2 mb-2">Roles</h3>
        <KnowledgeList
          items={roles}
          onChange={onChangeRoles}
          create={emptyRole}
          addLabel="Add role"
          emptyHint="No roles yet. Add the positions you've held; confirmed facts tagged to a role become resume bullets."
          isVisible={(role) => matches(`${role.title} ${role.period} ${organizationName(role.organizationId)}`, query)}
          itemTitle={(role) => (
            <span>
              {role.title || 'Untitled role'}
              <span className="text-faint"> · {organizationName(role.organizationId)}</span>
            </span>
          )}
          renderItem={(role, update) => (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Title">
                  <Input value={role.title} onChange={(e) => update({ title: e.target.value })} />
                </Field>
                <Field label="Organization">
                  <Select value={role.organizationId} onChange={(e) => update({ organizationId: e.target.value })}>
                    <option value="">— none —</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name || 'Untitled organization'}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Period">
                  <Input value={role.period} onChange={(e) => update({ period: e.target.value })} placeholder="2022 – Present" />
                </Field>
                <Field label="Location">
                  <Input value={role.location ?? ''} onChange={(e) => update({ location: e.target.value || undefined })} />
                </Field>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  )
}
