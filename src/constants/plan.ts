// RLS enforces these caps; the client copies exist only to show upgrade prompts before a write fails.
export type PlanTier = 'free' | 'pro'

/** Free-tier creation caps. Pro is unlimited. Must mirror the RLS limits in migration 0007. */
export const FREE_LIMITS = {
  jobs: 3,
  tailoredResumes: 1,
} as const

export function jobLimitReached(tier: PlanTier, jobCount: number): boolean {
  return tier === 'free' && jobCount >= FREE_LIMITS.jobs
}

/** How many more opportunities the plan accepts (`Infinity` on Pro). Never negative. */
export function remainingJobSlots(tier: PlanTier, jobCount: number): number {
  return tier === 'free' ? Math.max(0, FREE_LIMITS.jobs - jobCount) : Infinity
}

export function tailoredResumeLimitReached(tier: PlanTier, tailoredCount: number): boolean {
  return tier === 'free' && tailoredCount >= FREE_LIMITS.tailoredResumes
}
