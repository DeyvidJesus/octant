import type { JobAnalysis } from './analysis'
import type { JobSource, WorkMode } from './job'

/**
 * Job Discovery: opportunities found by AI research (a pasted Deep Research
 * report, an in-app search-grounded sweep, or an in-app Deep Research run)
 * land here as *candidates* — never directly on the board. The user triages a
 * review queue (quality over quantity); only approval creates a JobOpportunity.
 */

export type CandidateOrigin = 'paste' | 'sweep' | 'deep-research' | 'agent'

/** Whether the AI enrichment pass (explanation/gaps/recommendation) has run for a candidate. */
export type EnrichmentStatus = 'none' | 'pending' | 'done'

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
  /** Full deterministic analysis (matched/missing/categoryBreakdown/seniority), persisted so the
   *  card shows gaps without re-analysing. Undefined for thin/unscored candidates. */
  analysis?: JobAnalysis
  /** Provenance from the continuous pipeline. */
  runId?: string
  strategyId?: string
  /** AI enrichment lifecycle (Phase 3). */
  enrichmentStatus?: EnrichmentStatus
  /** AI-generated fit explanation + action recommendation (Phase 3). */
  explanation?: string
  recommendation?: string
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
}

export const DEFAULT_DISCOVERY_PREFS: DiscoveryPrefs = {
  targetRoles: '',
  regions: '',
  seniority: '',
  extraInstructions: '',
}

/** A single execution of the discovery pipeline — drives the "agent working" status + observability. */
export type DiscoveryRunStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed'
export type DiscoveryRunTrigger = 'manual' | 'session' | 'scheduled'

export interface DiscoveryRunStats {
  found?: number
  fresh?: number
  duplicates?: number
  scored?: number
  errors?: number
}

export interface DiscoveryRun {
  id: string
  status: DiscoveryRunStatus
  trigger: DiscoveryRunTrigger
  stats: DiscoveryRunStats
  tokensUsed: number
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}
