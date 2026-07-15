import { Card } from '@/components/ui/Card'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { Application } from '@/types/application'
import { APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'

export function ApplicationCard({ application }: { application: Application }) {
  return (
    <Card className="flex items-center justify-between p-4 bg-[#0d0d0d] hover:bg-surface transition">
      <div className="flex items-center gap-6">
        <div className="w-12 h-12 rounded-lg bg-surface-2 border border-edge-2 flex items-center justify-center shrink-0">
          <span className="text-lg font-bold text-white" aria-hidden>
            {application.company.charAt(0)}
          </span>
        </div>
        <div>
          <h3 className="text-white font-medium">{application.company}</h3>
          <p className="text-muted text-sm">{application.role}</p>
        </div>
      </div>
      <div className="flex items-center gap-8">
        {application.matchScore !== undefined && (
          <div className="text-right hidden md:block">
            <SectionLabel className="mb-1 normal-case">Match</SectionLabel>
            <div className="text-white font-medium">{application.matchScore}%</div>
          </div>
        )}
        <div className="text-right">
          <SectionLabel className="mb-1 normal-case">Status</SectionLabel>
          <div className="px-3 py-1 bg-surface-2 text-ink-2 text-xs rounded-full border border-edge-2">
            {APPLICATION_STAGE_LABELS[application.stage]}
          </div>
        </div>
      </div>
    </Card>
  )
}
