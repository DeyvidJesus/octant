import type { DiscoveredCandidate } from '@/types/discovery'
import type { JobOpportunity } from '@/types/job'
import { originToSource } from '@/types/discovery'
import { useJobsStore } from '@/stores/jobsStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useToastStore } from '@/stores/toastStore'
import { FREE_LIMITS, remainingJobSlots } from '@/constants/plan'
import { createId } from '@/utils/id'
import { nowIso } from '@/utils/dates'

/** Maps a candidate to a job with the same trim rules as JobFormPage.handleSubmit. */
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

/** Moves candidates onto the board up to the plan's free job slots; the rest stay queued. */
// Approving past the cap would lose them: the RLS cap rejects the job insert after they leave the queue.
export function approveCandidates(candidates: DiscoveredCandidate[]): JobOpportunity[] {
  const tier = useSubscriptionStore.getState().tier
  const slots = remainingJobSlots(tier, useJobsStore.getState().jobs.length)
  const accepted = candidates.slice(0, slots)
  const held = candidates.length - accepted.length
  if (held > 0) {
    useToastStore
      .getState()
      .notify(
        `The Free plan holds ${FREE_LIMITS.jobs} opportunities. ${held} left in the review queue — upgrade to Pro to approve more.`,
        'info',
      )
  }
  if (accepted.length === 0) return []

  const jobs = accepted.map(candidateToJob)
  useJobsStore.getState().addJobs(jobs)
  useDiscoveryStore.getState().removeCandidates(accepted.map((c) => c.id))
  return jobs
}
