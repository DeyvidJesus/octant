import type { JobAnalysis } from '@/types/analysis'
import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'

export interface AnalyzerContext {
  job: JobOpportunity
  resume: MasterResume
}

/** Invariant: `match.matched` must be the intersection of JD skills and resume skills. */
export interface JobAnalyzer {
  readonly id: string
  readonly kind: 'local' | 'llm'
  analyze(ctx: AnalyzerContext): Promise<JobAnalysis>
}
