import { useId, useState } from 'react'
import type { WorkMode } from '@/types/job'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
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

  // Stable field ids so each <label> is programmatically tied to its control.
  const uid = useId()
  const fid = (name: string) => `${uid}-${name}`

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
          <Field label="Company" htmlFor={fid('company')}>
            <Input id={fid('company')} value={values.company} onChange={(e) => set('company', e.target.value)} required />
          </Field>
          <Field label="Role" htmlFor={fid('role')}>
            <Input id={fid('role')} value={values.role} onChange={(e) => set('role', e.target.value)} required />
          </Field>
          <Field label="Posting URL" htmlFor={fid('url')}>
            <Input id={fid('url')} value={values.url} placeholder="https://…" onChange={(e) => set('url', e.target.value)} />
          </Field>
          <Field label="Category" htmlFor={fid('category')}>
            <Input id={fid('category')} value={values.category} placeholder="e.g. AI/SaaS" onChange={(e) => set('category', e.target.value)} />
          </Field>
          <Field label="Salary Range" htmlFor={fid('salary')}>
            <Input id={fid('salary')} value={values.salaryRange} placeholder="e.g. $120k-$150k" onChange={(e) => set('salaryRange', e.target.value)} />
          </Field>
          <Field label="Location" htmlFor={fid('location')}>
            <Input id={fid('location')} value={values.location} placeholder="e.g. Remote (US)" onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Work Mode" htmlFor={fid('workMode')}>
            <Select
              id={fid('workMode')}
              value={values.workMode}
              onChange={(e) => set('workMode', e.target.value as WorkMode)}
              className="capitalize"
            >
              {WORK_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tags" className="mb-4">
          <TagInput ariaLabel="Job tags" values={values.tags} onChange={(tags) => set('tags', tags)} />
        </Field>

        <Field label="Job Description (paste the full posting)" htmlFor={fid('description')}>
          <Textarea
            id={fid('description')}
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
