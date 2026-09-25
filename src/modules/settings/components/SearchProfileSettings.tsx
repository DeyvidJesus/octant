import { useId, useMemo } from 'react'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { TagInput } from '@/components/ui/TagInput'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { SENIORITY_OPTIONS, WORK_MODE_OPTIONS } from '@/types/searchProfile'
import { useSearchProfileStore } from '@/stores/searchProfileStore'
import { useResumeStore } from '@/stores/resumeStore'
import { resolveSearchProfile } from '@/services/discovery/deriveSearchProfile'

const SENIORITY_LABELS: Record<string, string> = {
  unknown: 'Any / from resume', junior: 'Junior', mid: 'Mid', senior: 'Senior', staff: 'Staff', lead: 'Lead',
}

/**
 * Structured inputs that steer the discovery agent. Empty fields fall back to values derived from the
 * Master Resume, so what's shown here is the *effective* profile (stored values over resume-derived).
 */
export function SearchProfileSettings() {
  const stored = useSearchProfileStore((s) => s.profile)
  const update = useSearchProfileStore((s) => s.updateProfile)
  const knowledgeBase = useResumeStore((s) => s.knowledgeBase)
  const uid = useId()

  // Effective profile: what discovery will actually use right now.
  const p = useMemo(() => resolveSearchProfile(stored, knowledgeBase), [stored, knowledgeBase])

  const toggleWorkMode = (mode: (typeof WORK_MODE_OPTIONS)[number]) => {
    update({ workModes: p.workModes.includes(mode) ? p.workModes.filter((m) => m !== mode) : [...p.workModes, mode] })
  }

  return (
    <Card className="space-y-6">
      <div>
        <SectionLabel>Discovery agent — search profile</SectionLabel>
        <p className="text-sm text-muted mt-1 leading-relaxed">
          What your agent looks for. Blank fields are inferred from your Knowledge Base.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Target roles" className="sm:col-span-2">
          <TagInput ariaLabel="Target roles" values={p.targetRoles} onChange={(v) => update({ targetRoles: v })} placeholder="Software Engineer, Full Stack…" />
        </Field>

        <Field label="Seniority" htmlFor={`${uid}-seniority`}>
          <Select id={`${uid}-seniority`} value={p.seniority} onChange={(e) => update({ seniority: e.target.value as typeof p.seniority })}>
            {SENIORITY_OPTIONS.map((level) => (
              <option key={level} value={level}>{SENIORITY_LABELS[level] ?? level}</option>
            ))}
          </Select>
        </Field>

        <Field label="Work mode">
          <div className="flex gap-2 pt-1">
            {WORK_MODE_OPTIONS.map((mode) => {
              const active = p.workModes.includes(mode)
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleWorkMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-sm border capitalize transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong ${
                    active ? 'bg-surface-2 text-ink-strong border-edge-2' : 'text-muted border-edge hover:text-ink-2'
                  }`}
                >
                  {mode}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Minimum salary" htmlFor={`${uid}-salary`}>
          <div className="flex gap-2">
            <Input
              id={`${uid}-salary`}
              type="number"
              min={0}
              value={p.salaryFloor ?? ''}
              placeholder="e.g. 120000"
              onChange={(e) => update({ salaryFloor: e.target.value ? Number(e.target.value) : undefined })}
            />
            <Input
              aria-label="Salary currency"
              className="w-24"
              value={p.salaryCurrency ?? ''}
              placeholder="USD"
              onChange={(e) => update({ salaryCurrency: e.target.value || undefined })}
            />
          </div>
        </Field>

        <Field label="Locations / regions" className="sm:col-span-2">
          <TagInput ariaLabel="Locations" values={p.locations} onChange={(v) => update({ locations: v })} placeholder="Remote — US, Europe (LATAM-friendly)…" />
        </Field>

        <Field label="Technologies" className="sm:col-span-2">
          <TagInput ariaLabel="Technologies" values={p.technologies} onChange={(v) => update({ technologies: v })} placeholder="React, TypeScript, Node…" />
        </Field>

        <Field label="Languages">
          <TagInput ariaLabel="Languages" values={p.languages} onChange={(v) => update({ languages: v })} placeholder="English, Portuguese…" />
        </Field>

        <Field label="Must include keywords">
          <TagInput ariaLabel="Include keywords" values={p.includeKeywords} onChange={(v) => update({ includeKeywords: v })} placeholder="product, SaaS…" />
        </Field>

        <Field label="Exclude keywords" className="sm:col-span-2">
          <TagInput ariaLabel="Exclude keywords" values={p.excludeKeywords} onChange={(v) => update({ excludeKeywords: v })} placeholder="crypto, agency, on-call…" />
        </Field>

        <Field label="Additional instructions" className="sm:col-span-2">
          <Textarea
            rows={3}
            value={p.extraInstructions}
            placeholder="Prefer product companies over agencies. Avoid early-stage pre-seed."
            onChange={(e) => update({ extraInstructions: e.target.value })}
          />
        </Field>
      </div>
    </Card>
  )
}
