import { useState } from 'react'
import type { ApplicationStage } from '@/types/application'
import type { WorkMode } from '@/types/job'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS, TERMINAL_STAGES } from '@/constants/applicationStages'
import { WORK_MODES, type ApplicationFormValues } from './applicationFormValues'

interface ApplicationFormProps {
  initial: ApplicationFormValues
  submitLabel: string
  onSubmit: (values: ApplicationFormValues) => void
  onCancel: () => void
}

export function ApplicationForm({ initial, submitLabel, onSubmit, onCancel }: ApplicationFormProps) {
  const [values, setValues] = useState<ApplicationFormValues>(initial)
  const set = <K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }))

  const canSubmit = values.company.trim() !== '' && values.role.trim() !== ''
  const isTerminal = TERMINAL_STAGES.includes(values.stage)

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (canSubmit) onSubmit(values)
      }}
    >
      <Card className="space-y-6">
        <div>
          <SectionLabel className="mb-3">Basics</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company">
              <Input value={values.company} onChange={(e) => set('company', e.target.value)} required />
            </Field>
            <Field label="Role">
              <Input value={values.role} onChange={(e) => set('role', e.target.value)} required />
            </Field>
            <Field label="Stage">
              <Select value={values.stage} onChange={(e) => set('stage', e.target.value as ApplicationStage)}>
                {APPLICATION_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {APPLICATION_STAGE_LABELS[stage]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <label className="flex items-center gap-2 text-sm text-ink-2 py-2">
                <input
                  type="checkbox"
                  checked={values.priority}
                  onChange={(e) => set('priority', e.target.checked)}
                  className="accent-white"
                />
                Flag as a priority application
              </label>
            </Field>
          </div>
        </div>

        <div>
          <SectionLabel className="mb-3">Comp &amp; logistics</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Salary Range">
              <Input value={values.salary} placeholder="e.g. $120k-$150k" onChange={(e) => set('salary', e.target.value)} />
            </Field>
            <Field label="Location">
              <Input value={values.location} placeholder="e.g. Remote (US)" onChange={(e) => set('location', e.target.value)} />
            </Field>
            <Field label="Work Mode">
              <Select
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
            <Field label="Application URL">
              <Input value={values.applicationUrl} placeholder="https://…" onChange={(e) => set('applicationUrl', e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <SectionLabel className="mb-3">Dates</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Applied on">
              <Input type="date" value={values.appliedAt} onChange={(e) => set('appliedAt', e.target.value)} />
            </Field>
            <Field label="Next follow-up">
              <Input type="date" value={values.followUpAt} onChange={(e) => set('followUpAt', e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <SectionLabel className="mb-3">Contact</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Recruiter name">
              <Input value={values.recruiterName} onChange={(e) => set('recruiterName', e.target.value)} />
            </Field>
            <Field label="Recruiter email">
              <Input type="email" value={values.recruiterEmail} onChange={(e) => set('recruiterEmail', e.target.value)} />
            </Field>
            <Field label="Recruiter LinkedIn">
              <Input value={values.recruiterLinkedin} placeholder="https://linkedin.com/in/…" onChange={(e) => set('recruiterLinkedin', e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <SectionLabel className="mb-3">Notes</SectionLabel>
          <Field label="Notes">
            <Textarea
              rows={5}
              value={values.notes}
              placeholder="Prep notes, context, what stood out…"
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
          {isTerminal && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <Field label="Feedback received">
                <Textarea rows={3} value={values.feedback} onChange={(e) => set('feedback', e.target.value)} />
              </Field>
              <Field label="Reason (if rejected/withdrawn)">
                <Textarea rows={3} value={values.rejectionReason} onChange={(e) => set('rejectionReason', e.target.value)} />
              </Field>
            </div>
          )}
        </div>

        <div className="flex gap-3">
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
