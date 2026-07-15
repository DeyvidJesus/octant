import { KanbanSquare } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { ApplicationCard } from './components/ApplicationCard'

export function ApplicationsPage() {
  const applications = useApplicationsStore((state) => state.applications)

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="No applications yet"
        description="Analyze an opportunity and save it here to start tracking your pipeline."
      />
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <PageHeader title="Application Pipeline" />
      <div className="grid gap-4">
        {applications.map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))}
      </div>
    </div>
  )
}
