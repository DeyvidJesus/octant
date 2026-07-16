import type { JobOpportunity } from '@/types/job'
import type { JobAnalysis } from '@/types/analysis'

/** The persisted slice of the jobs store. */
export interface PersistedJobs {
  jobs: JobOpportunity[]
  analyses: Record<string, JobAnalysis>
}

/**
 * Migrates persisted jobs state across schema versions. v1 jobs predate the
 * `source` provenance field — everything back then was hand-entered. Kept pure
 * and tested so old backups remain restorable (same discipline as the resume
 * migrations).
 */
export function migrateJobsState(persisted: unknown, fromVersion: number): PersistedJobs {
  if (fromVersion >= 2) return persisted as PersistedJobs

  const old = persisted as Partial<PersistedJobs> | undefined
  return {
    jobs: (old?.jobs ?? []).map((job) => ({ ...job, source: job.source ?? 'manual' })),
    analyses: old?.analyses ?? {},
  }
}
