import type { DiscoveredCandidate } from '@/types/discovery'
import type { JobOpportunity } from '@/types/job'
import { originToSource } from '@/types/discovery'
import { useJobsStore } from '@/stores/jobsStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

/** Pure mapping — same trim/`|| undefined` idiom as JobFormPage.handleSubmit. */
export function candidateToJob(candidate: DiscoveredCandidate): JobOpportunity {
  return {
    id: createId(),
    company: candidate.company.trim(),
    role: candidate.role.trim(),
    description: candidate.description.trim(),
    url: candidate.url?.trim() || undefined,
    salaryRange: candidate.salaryRange?.trim() || undefined,
    location: candidate.location?.trim() || undefined,
    workMode: candidate.workMode,
    tags: [],
    createdAt: nowIso(),
    archived: false,
    source: originToSource(candidate.origin),
  }
}

/**
 * Moves approved candidates from the review queue onto the board.
 * Returns the created jobs (single-approve uses the id to navigate to analysis).
 */
export function approveCandidates(candidates: DiscoveredCandidate[]): JobOpportunity[] {
  const jobs = candidates.map(candidateToJob)
  useJobsStore.getState().addJobs(jobs)
  useDiscoveryStore.getState().removeCandidates(candidates.map((c) => c.id))
  return jobs
}
