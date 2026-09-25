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

/** Terminal stages — the application is closed, favorably or not. */
export const TERMINAL_STAGES: ApplicationStage[] = ['accepted', 'rejected', 'withdrawn', 'ghosted']

/**
 * Pill classes per stage (background/border/text) for badges and board headers. This is a
 * categorical palette (one hue per pipeline stage), not a status intent, so it uses Tailwind hues
 * directly and lives only here. Status meaning (success/danger/…) comes from the tokens in index.css.
 */
export const APPLICATION_STAGE_COLORS: Record<ApplicationStage, string> = {
  saved: 'bg-surface-2 border-edge-2 text-ink-2',
  applied: 'bg-indigo-900/30 border-indigo-800/50 text-indigo-300',
  screening: 'bg-sky-900/30 border-sky-800/50 text-sky-300',
  interviewing: 'bg-violet-900/30 border-violet-800/50 text-violet-300',
  technical: 'bg-amber-900/30 border-amber-800/50 text-amber-300',
  offer: 'bg-emerald-900/30 border-emerald-800/50 text-emerald-300',
  accepted: 'bg-emerald-600/30 border-emerald-500/50 text-emerald-200',
  rejected: 'bg-red-900/30 border-red-800/50 text-red-300',
  withdrawn: 'bg-surface-2 border-edge-2 text-muted',
  ghosted: 'bg-surface-2 border-edge-2 text-muted',
}

export interface BoardColumn {
  key: string
  label: string
  /** Stages aggregated into this column, in order. */
  stages: ApplicationStage[]
}

/**
 * Board layout: the six active pipeline stages as their own columns, with all
 * terminal stages aggregated into a single "Closed" column so the board stays
 * scannable. Dropping onto "Closed" defaults to the first terminal stage.
 */
export const BOARD_COLUMNS: BoardColumn[] = [
  { key: 'saved', label: 'Saved', stages: ['saved'] },
  { key: 'applied', label: 'Applied', stages: ['applied'] },
  { key: 'screening', label: 'Screening', stages: ['screening'] },
  { key: 'interviewing', label: 'Interviewing', stages: ['interviewing'] },
  { key: 'technical', label: 'Technical', stages: ['technical'] },
  { key: 'offer', label: 'Offer', stages: ['offer'] },
  { key: 'closed', label: 'Closed', stages: TERMINAL_STAGES },
]
