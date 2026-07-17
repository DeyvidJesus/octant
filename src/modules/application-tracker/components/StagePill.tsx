import type { ApplicationStage } from '@/types/application'
import { APPLICATION_STAGE_COLORS, APPLICATION_STAGE_LABELS } from '@/constants/applicationStages'

export function StagePill({ stage }: { stage: ApplicationStage }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 border rounded-full text-xs ${APPLICATION_STAGE_COLORS[stage]}`}>
      {APPLICATION_STAGE_LABELS[stage]}
    </span>
  )
}
