import { useState } from 'react'
import type { Application, ApplicationStage } from '@/types/application'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { BOARD_COLUMNS } from '@/constants/applicationStages'
import { groupBy } from '@/utils/collections'
import { ApplicationCard } from './ApplicationCard'

const DRAG_TYPE = 'application/id'

export function BoardView({ applications }: { applications: Application[] }) {
  const moveStage = useApplicationsStore((state) => state.moveStage)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const byStage = groupBy(applications, (app) => app.stage)

  const handleDrop = (event: React.DragEvent, toStage: ApplicationStage) => {
    event.preventDefault()
    setDragOver(null)
    const id = event.dataTransfer.getData(DRAG_TYPE)
    if (id) moveStage(id, toStage)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((column) => {
        const cards = column.stages.flatMap((stage) => byStage[stage] ?? [])
        // Dropping onto an aggregate column targets its first (primary) stage.
        const dropStage = column.stages[0]
        return (
          <div
            key={column.key}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(column.key)
            }}
            onDragLeave={() => setDragOver((current) => (current === column.key ? null : current))}
            onDrop={(e) => handleDrop(e, dropStage)}
            className={`w-72 shrink-0 rounded-xl border p-3 transition-colors ${
              dragOver === column.key ? 'border-ghost bg-surface' : 'border-edge bg-base/40'
            }`}
          >
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-semibold text-ink-2 uppercase tracking-widest">{column.label}</span>
              <span className="text-xs text-faint">{cards.length}</span>
            </div>
            <div className="space-y-2 min-h-12">
              {cards.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  compact
                  onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, application.id)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
