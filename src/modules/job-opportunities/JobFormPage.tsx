import { useNavigate, useParams } from 'react-router-dom'
import { Briefcase } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useJobsStore } from '@/stores/jobsStore'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'
import { JobForm } from './components/JobForm'
import { toFormValues, type JobFormValues } from './components/jobFormValues'

export function JobFormPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const existing = useJobsStore((state) => (jobId ? state.jobs.find((j) => j.id === jobId) : undefined))
  const addJob = useJobsStore((state) => state.addJob)
  const updateJob = useJobsStore((state) => state.updateJob)

  const isEditing = Boolean(jobId)

  if (isEditing && !existing) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Opportunity not found"
        description="This job may have been removed."
        action={
          <Button variant="subtle" onClick={() => navigate('/jobs')}>
            Back to Opportunity Board
          </Button>
        }
      />
    )
  }

  const handleSubmit = (values: JobFormValues) => {
    const patch = {
      company: values.company.trim(),
      role: values.role.trim(),
      description: values.description.trim(),
      url: values.url.trim() || undefined,
      category: values.category.trim() || undefined,
      salaryRange: values.salaryRange.trim() || undefined,
      location: values.location.trim() || undefined,
      workMode: values.workMode,
      tags: values.tags,
    }

    if (existing) {
      updateJob(existing.id, patch)
      navigate(`/jobs/${existing.id}/analysis`)
    } else {
      const id = createId()
      addJob({ id, ...patch, createdAt: nowIso(), archived: false })
      navigate(`/jobs/${id}/analysis`)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto animate-fade-in pb-24">
      <PageHeader
        title={isEditing ? 'Edit Opportunity' : 'Add Opportunity'}
        subtitle="Paste a real job description — the analyzer runs on this text to match it against your Master Resume."
      />
      <JobForm
        initial={toFormValues(existing)}
        submitLabel={isEditing ? 'Save & Analyze' : 'Add & Analyze'}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/jobs')}
      />
    </div>
  )
}
