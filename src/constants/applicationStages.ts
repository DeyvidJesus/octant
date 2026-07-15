import type { ApplicationStage } from '@/types/application'

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  saved: 'Saved',
  applied: 'Applied',
  screening: 'Screening',
  interviewing: 'Interviewing',
  technical: 'Technical',
  offer: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
}

export const APPLICATION_STAGES = Object.keys(APPLICATION_STAGE_LABELS) as ApplicationStage[]

/** Stages that count as an active interview process. */
export const INTERVIEW_STAGES: ApplicationStage[] = ['screening', 'interviewing', 'technical', 'offer']
