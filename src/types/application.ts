import type { LabeledLink } from './resume'
import type { WorkMode } from './job'

export type ApplicationStage =
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interviewing'
  | 'technical'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted'

export interface Application {
  id: string
  /** Optional link to a JobOpportunity. */
  jobId?: string
  /** Denormalized so the application survives job deletion. */
  company: string
  role: string
  salary?: string
  location?: string
  workMode: WorkMode
  stage: ApplicationStage
  createdAt: string
  appliedAt?: string
  updatedAt: string
  recruiter?: RecruiterContact
  links: LabeledLink[]
  notes: string
  feedback?: string
  rejectionReason?: string
  /** Drives "follow up due" surfacing on the dashboard. */
  followUpAt?: string
  /** Snapshot of the analysis match score at save time. */
  matchScore?: number
}

export interface RecruiterContact {
  name?: string
  email?: string
  linkedin?: string
}
