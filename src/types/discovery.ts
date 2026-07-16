import type { JobSource, WorkMode } from './job'

/**
 * Job Discovery: opportunities found by AI research (a pasted Deep Research
 * report, an in-app search-grounded sweep, or an in-app Deep Research run)
 * land here as *candidates* — never directly on the board. The user triages a
 * review queue (quality over quantity); only approval creates a JobOpportunity.
 */

export type CandidateOrigin = 'paste' | 'sweep' | 'deep-research'

export interface DiscoveredCandidate {
  id: string
  company: string
  role: string
  /** Whatever the report said about the job — may be a thin search snippet. */
  description: string
  url?: string
  location?: string
  salaryRange?: string
  workMode: WorkMode
  origin: CandidateOrigin
  /** Provenance for the card footer, e.g. "gemini · gemini-2.0-flash". */
  sourceNote: string
  foundAt: string
  /**
   * Local heuristic ATS score, computed at ingest so triage is score-informed.
   * Undefined when the description is too thin to score honestly.
   */
  matchScore?: number
}

/** Approved candidates become board jobs with this provenance. */
export function originToSource(origin: CandidateOrigin): JobSource {
  return origin === 'paste' ? 'imported' : 'discovered'
}

/** User-tunable inputs for the discovery prompts, persisted in settings. */
export interface DiscoveryPrefs {
  /** e.g. "Software Engineer, Full Stack Engineer, Product Engineer" */
  targetRoles: string
  /** e.g. "Remote — US, Canada, Europe (LATAM-friendly)" */
  regions: string
  /** e.g. "junior / mid-level" */
  seniority: string
  /** Free text appended to every discovery prompt. */
  extraInstructions: string
  /** Show a banner on the board when the last sweep is older than a day. */
  staleReminder: boolean
}

export const DEFAULT_DISCOVERY_PREFS: DiscoveryPrefs = {
  targetRoles: '',
  regions: '',
  seniority: '',
  extraInstructions: '',
  staleReminder: false,
}
