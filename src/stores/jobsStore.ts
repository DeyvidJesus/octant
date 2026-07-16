import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JobOpportunity } from '@/types/job'
import type { JobAnalysis } from '@/types/analysis'
import { createSeedJobs } from '@/constants/seedData'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { migrateJobsState } from './jobsMigrations'

interface JobsState {
  jobs: JobOpportunity[]
  /** Latest analysis per job id. */
  analyses: Record<string, JobAnalysis>
  addJob: (job: JobOpportunity) => void
  /** Bulk insert (discovery approvals) — one state update, one persist write. */
  addJobs: (jobs: JobOpportunity[]) => void
  updateJob: (id: string, patch: Partial<JobOpportunity>) => void
  removeJob: (id: string) => void
  saveAnalysis: (analysis: JobAnalysis) => void
}

export const useJobsStore = create<JobsState>()(
  persist(
    (set) => ({
      jobs: createSeedJobs(),
      analyses: {},
      addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
      addJobs: (jobs) => set((state) => ({ jobs: [...jobs, ...state.jobs] })),
      updateJob: (id, patch) =>
        set((state) => ({
          jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
        })),
      removeJob: (id) =>
        set((state) => {
          const analyses = { ...state.analyses }
          delete analyses[id]
          return { jobs: state.jobs.filter((job) => job.id !== id), analyses }
        }),
      saveAnalysis: (analysis) =>
        set((state) => ({
          analyses: { ...state.analyses, [analysis.jobId]: analysis },
        })),
    }),
    {
      name: STORAGE_KEYS.jobs,
      storage: appStorage,
      version: 2,
      migrate: (persisted, version) => migrateJobsState(persisted, version),
    },
  ),
)
