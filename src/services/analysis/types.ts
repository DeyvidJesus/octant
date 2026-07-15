import type { JobAnalysis } from '@/types/analysis'
import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'

export interface AnalyzerContext {
  job: JobOpportunity
  resume: MasterResume
}

/**
 * The AI-ready seam of CareerOS. The UI only ever talks to this interface;
 * today the implementation is a deterministic local heuristic, later an
 * LLM-backed analyzer can be added without touching any module.
 *
 * Invariant for every implementation: `match.matched` must be a set
 * intersection of JD skills and resume skills — an analyzer can never claim
 * experience the Master Resume doesn't contain.
 */
export interface JobAnalyzer {
  readonly id: string
  readonly kind: 'local' | 'llm'
  analyze(ctx: AnalyzerContext): Promise<JobAnalysis>
}
