import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KanbanSquare, Plus, Table } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { BoardView } from './components/BoardView'
import { TableView } from './components/TableView'

type ViewMode = 'board' | 'table'

export function ApplicationsPage() {
  const navigate = useNavigate()
  const applications = useApplicationsStore((state) => state.applications)
  const [view, setView] = useState<ViewMode>('board')

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={KanbanSquare}
        title="No applications yet"
        description="Analyze an opportunity and save it here, or add one manually to start tracking your pipeline."
        action={<Button onClick={() => navigate('/applications/new')}>New application</Button>}
      />
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      <PageHeader
        title="Application Tracker"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-edge-2 overflow-hidden">
              <ViewToggle active={view === 'board'} onClick={() => setView('board')} icon={KanbanSquare} label="Board" />
              <ViewToggle active={view === 'table'} onClick={() => setView('table')} icon={Table} label="Table" />
            </div>
            <Button onClick={() => navigate('/applications/new')}>
              <Plus size={16} aria-hidden />
              New application
            </Button>
          </div>
        }
      />
      {view === 'board' ? <BoardView applications={applications} /> : <TableView applications={applications} />}
    </div>
  )
}

function ViewToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof KanbanSquare
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
        active ? 'bg-white text-black font-medium' : 'text-muted hover:text-ink-2'
      }`}
    >
      <Icon size={15} aria-hidden />
      {label}
    </button>
  )
}
