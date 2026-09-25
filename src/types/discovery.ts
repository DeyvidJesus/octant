import type { JobAnalysis } from './analysis'
import type { JobSource, WorkMode } from './job'

// AI-discovered jobs land as candidates in a review queue; only approval creates a JobOpportunity.

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
  /** Heuristic ATS score computed at ingest; undefined when the description is too thin to score. */
  matchScore?: number
  /** Persisted so the card shows gaps without re-analysing. Undefined for unscored candidates. */
  analysis?: JobAnalysis
  /** Provenance from the continuous pipeline. */
  runId?: string
  strategyId?: string
  enrichmentStatus?: EnrichmentStatus
  /** AI-generated fit explanation and action recommendation. */
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
