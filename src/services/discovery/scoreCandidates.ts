import type { DiscoveredCandidate } from '@/types/discovery'
import type { JobOpportunity } from '@/types/job'
import type { MasterResume } from '@/types/resume'
import { getAnalyzer } from '@/services/analysis/localHeuristicAnalyzer'

/**
 * Below this, a description is a search snippet, not a job description —
 * an ATS score computed from it would be noise presented as truth.
 */
export const MIN_SCORABLE_DESCRIPTION = 200

/**
 * Scores each candidate with the local heuristic analyzer so triage is
 * score-informed before anything reaches the board. Candidates with thin
 * descriptions keep `matchScore` undefined rather than getting a fake number.
 * The analysis object is discarded — only approved jobs persist analyses.
 */
export async function scoreCandidates(
  candidates: DiscoveredCandidate[],
  resume: MasterResume,
): Promise<DiscoveredCandidate[]> {
  const analyzer = getAnalyzer()

  return Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.description.trim().length < MIN_SCORABLE_DESCRIPTION) return candidate

      const job: JobOpportunity = {
        id: candidate.id,
        company: candidate.company,
        role: candidate.role,
        description: candidate.description,
        url: candidate.url,
        location: candidate.location,
        salaryRange: candidate.salaryRange,
        workMode: candidate.workMode,
        tags: [],
        createdAt: candidate.foundAt,
        archived: false,
        source: 'discovered',
      }
      const analysis = await analyzer.analyze({ job, resume })
      return { ...candidate, matchScore: analysis.match.atsScore }
    }),
  )
}
