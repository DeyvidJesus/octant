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
  /** User-flagged priority application. */
  priority?: boolean
  /** Chronological activity log (creation, stage changes, notes, contacts). */
  events: ApplicationEvent[]
}

export interface RecruiterContact {
  name?: string
  email?: string
  linkedin?: string
}

export type ApplicationEventKind = 'created' | 'stage_change' | 'note' | 'contact' | 'follow_up'

export interface ApplicationEvent {
  id: string
  /** ISO timestamp of the event. */
  at: string
  kind: ApplicationEventKind
  /** Free-text detail for note/contact/follow_up events. */
  text?: string
  /** Populated for stage_change events. */
  fromStage?: ApplicationStage
  toStage?: ApplicationStage
}
