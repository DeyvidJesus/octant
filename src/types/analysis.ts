export type SeniorityLevel = 'junior' | 'mid' | 'senior' | 'staff' | 'lead' | 'unknown'

/** Hard requirement vs "nice to have"; drives gap triage and ATS weighting. */
export type RequirementImportance = 'required' | 'preferred'

/** A job description analyzed against the Master Resume; the shape is analyzer-independent. */
export interface JobAnalysis {
  jobId: string
  /** Which engine produced this, e.g. 'local-heuristic-v1'. */
  analyzerId: string
  analyzedAt: string
  detectedStack: DetectedSkill[]
  detectedSeniority: SeniorityLevel
  /** Actual phrases from the JD that justified the seniority call. */
  seniorityEvidence: string[]
  /** Taxonomy hits sorted by frequency — what an ATS scans for. */
  atsKeywords: string[]
  match: MatchReport
}

export interface DetectedSkill {
  /** As written in the JD, e.g. "TS". */
  term: string
  /** Normalized name, e.g. "TypeScript". */
  canonical: string
  category: string
  count: number
  inResume: boolean
  importance: RequirementImportance
}

export interface MatchReport {
  /** 0-100, frequency-weighted coverage of JD skills by the resume. */
  atsScore: number
  /** Always a set intersection, so no analyzer can claim experience the resume lacks. */
  matched: string[]
  /** Skills the JD wants that the resume lacks — shown as gaps, never filled in. */
  missing: string[]
  categoryBreakdown: CategoryScore[]
  /** Deterministic observations templated from real data only. */
  notes: string[]
}

export interface CategoryScore {
  category: string
  /** 0-5 coverage score, rendered by ScoreBar. */
  score: number
  matched: string[]
  missing: string[]
}
