import { useState } from 'react'
import type { WorkMode } from '@/types/job'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { TagInput } from '@/components/ui/TagInput'
import { WORK_MODES, type JobFormValues } from './jobFormValues'

interface JobFormProps {
  initial: JobFormValues
  submitLabel: string
  onSubmit: (values: JobFormValues) => void
  onCancel: () => void
}

export function JobForm({ initial, submitLabel, onSubmit, onCancel }: JobFormProps) {
  const [values, setValues] = useState<JobFormValues>(initial)
  const set = <K extends keyof JobFormValues>(key: K, value: JobFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const canSubmit = values.company.trim() !== '' && values.role.trim() !== ''

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit(values)
      }}
    >
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Field label="Company">
            <Input value={values.company} onChange={(e) => set('company', e.target.value)} required />
          </Field>
          <Field label="Role">
            <Input value={values.role} onChange={(e) => set('role', e.target.value)} required />
          </Field>
          <Field label="Posting URL">
            <Input value={values.url} placeholder="https://…" onChange={(e) => set('url', e.target.value)} />
          </Field>
          <Field label="Category">
            <Input value={values.category} placeholder="e.g. AI/SaaS" onChange={(e) => set('category', e.target.value)} />
          </Field>
          <Field label="Salary Range">
            <Input value={values.salaryRange} placeholder="e.g. $120k-$150k" onChange={(e) => set('salaryRange', e.target.value)} />
          </Field>
          <Field label="Location">
            <Input value={values.location} placeholder="e.g. Remote (US)" onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Work Mode">
            <select
              value={values.workMode}
              onChange={(e) => set('workMode', e.target.value as WorkMode)}
              className="w-full bg-base border border-edge-2 rounded px-3 py-2 text-sm text-ink-2 focus:outline-none focus:border-[#555] capitalize"
            >
              {WORK_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Tags" className="mb-4">
          <TagInput ariaLabel="Job tags" values={values.tags} onChange={(tags) => set('tags', tags)} />
        </Field>

        <Field label="Job Description (paste the full posting)">
          <Textarea
            rows={14}
            value={values.description}
            placeholder="Paste the complete job description here. The analyzer reads this text to detect the required stack, seniority, and how you match."
            onChange={(e) => set('description', e.target.value)}
          />
        </Field>

        <div className="flex gap-3 mt-6">
          <Button type="submit" disabled={!canSubmit}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Card>
    </form>
  )
}
