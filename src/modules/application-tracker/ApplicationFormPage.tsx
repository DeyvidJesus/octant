import { useNavigate, useParams } from 'react-router-dom'
import { KanbanSquare } from 'lucide-react'
import type { Application, RecruiterContact } from '@/types/application'
import type { LabeledLink } from '@/types/resume'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { confirm } from '@/stores/confirmStore'
import { createId } from '@/utils/id'
import { fromDateInput, nowIso } from '@/utils/dates'
import { ApplicationForm } from './components/ApplicationForm'
import { ApplicationTimeline } from './components/ApplicationTimeline'
import { toFormValues, type ApplicationFormValues } from './components/applicationFormValues'

export function ApplicationFormPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()
  const existing = useApplicationsStore((state) =>
    applicationId ? state.applications.find((app) => app.id === applicationId) : undefined,
  )
  const upsertApplication = useApplicationsStore((state) => state.upsertApplication)
  const updateApplication = useApplicationsStore((state) => state.updateApplication)
  const moveStage = useApplicationsStore((state) => state.moveStage)
  const removeApplication = useApplicationsStore((state) => state.removeApplication)

  const isEditing = Boolean(applicationId)

  if (isEditing && !existing) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="Application not found"
        description="This application may have been removed."
        action={
          <Button variant="subtle" onClick={() => navigate('/applications')}>
            Back to Application Tracker
          </Button>
        }
      />
    )
  }

  const handleSubmit = (values: ApplicationFormValues) => {
    const recruiter = buildRecruiter(values)
    const links = buildLinks(values, existing?.links)
    const shared = {
      company: values.company.trim(),
      role: values.role.trim(),
      priority: values.priority,
      salary: values.salary.trim() || undefined,
      location: values.location.trim() || undefined,
      workMode: values.workMode,
      appliedAt: fromDateInput(values.appliedAt),
      followUpAt: fromDateInput(values.followUpAt),
      recruiter,
      links,
      notes: values.notes,
      feedback: values.feedback.trim() || undefined,
      rejectionReason: values.rejectionReason.trim() || undefined,
    }

    if (existing) {
      // Stage changes route through moveStage so the timeline records them.
      updateApplication(existing.id, shared)
      if (values.stage !== existing.stage) moveStage(existing.id, values.stage)
      navigate('/applications')
      return
    }

    const now = nowIso()
    const application: Application = {
      id: createId(),
      ...shared,
      stage: values.stage,
      createdAt: now,
      updatedAt: now,
      events: [{ id: createId(), at: now, kind: 'created' }],
    }
    upsertApplication(application)
    navigate('/applications')
  }

  const handleDelete = async () => {
    if (!existing) return
    const ok = await confirm({
      title: 'Delete application?',
      message: `Delete the application for ${existing.company} — ${existing.role}?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (ok) {
      removeApplication(existing.id)
      navigate('/applications')
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in pb-24 space-y-6">
      <PageHeader
        title={isEditing ? 'Edit Application' : 'New Application'}
        subtitle="Track this opportunity through the hiring funnel — stages, follow-ups, contacts, and notes."
        actions={
          isEditing ? (
            <Button variant="ghost" onClick={handleDelete}>
              Delete
            </Button>
          ) : undefined
        }
      />
      <ApplicationForm
        initial={toFormValues(existing)}
        submitLabel={isEditing ? 'Save Application' : 'Create Application'}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/applications')}
      />
      {existing && <ApplicationTimeline application={existing} />}
    </div>
  )
}

function buildRecruiter(values: ApplicationFormValues): RecruiterContact | undefined {
  const name = values.recruiterName.trim()
  const email = values.recruiterEmail.trim()
  const linkedin = values.recruiterLinkedin.trim()
  if (!name && !email && !linkedin) return undefined
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(linkedin ? { linkedin } : {}),
  }
}

function buildLinks(values: ApplicationFormValues, existing?: LabeledLink[]): LabeledLink[] {
  const url = values.applicationUrl.trim()
  if (!url) return []
  const label = existing?.[0]?.label ?? 'Application'
  return [{ label, url }]
}
