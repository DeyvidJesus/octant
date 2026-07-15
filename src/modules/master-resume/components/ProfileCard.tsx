import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'
import type { MasterResume } from '@/types/resume'

export function ProfileCard({ resume }: { resume: MasterResume }) {
  return (
    <Card>
      <h3 className="text-lg font-medium text-white mb-4">Career Profile & Values</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Field label="Full Name">
          <Input value={resume.personal.name} readOnly aria-label="Full name" />
        </Field>
        <Field label="Current Role">
          <Input value={resume.personal.role} readOnly aria-label="Current role" />
        </Field>
        <Field label="Location">
          <Input value={resume.personal.location} readOnly aria-label="Location" />
        </Field>
        <Field label="English">
          <Input value={resume.personal.english} readOnly aria-label="English level" />
        </Field>
      </div>
      <Field label="Professional Objective" className="mb-4">
        <Textarea value={resume.goals} readOnly rows={2} aria-label="Professional objective" />
      </Field>
      <Field label="Engineering Values">
        <div className="flex flex-wrap gap-2">
          {resume.values.map((value) => (
            <Badge key={value}>{value}</Badge>
          ))}
        </div>
      </Field>
    </Card>
  )
}

function Field({
  label,
  className = '',
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-faint mb-1 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  )
}
