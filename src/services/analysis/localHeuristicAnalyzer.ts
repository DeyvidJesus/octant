import type { JobAnalysis } from '@/types/analysis'
import type { AnalyzerContext, JobAnalyzer } from './types'
import { detectSeniority, extractSkills } from './extract'
import { buildMatchReport, collectResumeSkills } from './match'

/**
 * Deterministic, offline job analysis: taxonomy-based keyword extraction,
 * regex seniority detection, and frequency-weighted ATS scoring against the
 * Master Resume. Same input always produces the same output.
 */
class LocalHeuristicAnalyzer implements JobAnalyzer {
  readonly id = 'local-heuristic-v2'
  readonly kind = 'local' as const

  async analyze({ job, resume }: AnalyzerContext): Promise<JobAnalysis> {
    const jdText = `${job.role}\n${job.description}`
    const jdHits = extractSkills(jdText)
    const seniority = detectSeniority(jdText)
    const resumeSkills = collectResumeSkills(resume)
    const match = buildMatchReport(jdHits, resumeSkills)

    return {
      jobId: job.id,
      analyzerId: this.id,
      analyzedAt: new Date().toISOString(),
      detectedStack: jdHits.map((hit) => ({
        term: hit.term,
        canonical: hit.entry.canonical,
        category: hit.entry.category,
        count: hit.count,
        inResume: resumeSkills.has(hit.entry.canonical),
        importance: hit.importance,
      })),
      detectedSeniority: seniority.level,
      seniorityEvidence: seniority.evidence,
      atsKeywords: jdHits.map((hit) => hit.entry.canonical),
      match,
    }
  }
}

/**
 * The entire analyzer "registry". When an LLM-backed analyzer arrives,
 * this reads a provider setting and returns the right implementation —
 * nothing else in the app changes.
 */
export function getAnalyzer(): JobAnalyzer {
  return new LocalHeuristicAnalyzer()
}
