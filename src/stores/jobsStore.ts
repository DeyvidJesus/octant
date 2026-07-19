import { create } from 'zustand'
import type { JobOpportunity } from '@/types/job'
import type { JobAnalysis } from '@/types/analysis'
import { createSeedJobs } from '@/constants/seedData'
import { jobRepository } from '@/repositories/JobRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from '@/repositories/persist'

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
  _fetchFromSupabase: () => Promise<void>
  /** Subscribes to cross-device changes; returns an unsubscribe function. */
  _subscribeRealtime: () => () => void
}

export const useJobsStore = create<JobsState>()(
  (set, get) => ({
    jobs: createSeedJobs(),
    analyses: {},
    addJob: (job) => {
      set((state) => ({ jobs: [job, ...state.jobs] }))
      persist(() => jobRepository.upsertJob(job), 'jobs.addJob')
    },
    addJobs: (jobs) => {
      set((state) => ({ jobs: [...jobs, ...state.jobs] }))
      persist(() => jobRepository.upsertJobs(jobs), 'jobs.addJobs')
    },
    updateJob: (id, patch) => {
      set((state) => ({
        jobs: state.jobs.map((job) => (job.id === id ? { ...job, ...patch } : job)),
      }))
      const job = get().jobs.find((j) => j.id === id)
      if (job) persist(() => jobRepository.upsertJob(job), 'jobs.updateJob')
    },
    removeJob: (id) => {
      set((state) => {
        const analyses = { ...state.analyses }
        delete analyses[id]
        return { jobs: state.jobs.filter((job) => job.id !== id), analyses }
      })
      persist(() => jobRepository.deleteJob(id), 'jobs.removeJob')
    },
    saveAnalysis: (analysis) => {
      set((state) => ({
        analyses: { ...state.analyses, [analysis.jobId]: analysis },
      }))
      persist(() => jobRepository.upsertAnalysis(analysis), 'jobs.saveAnalysis')
    },
    _fetchFromSupabase: async () => {
      try {
        const [jobs, analyses] = await Promise.all([
          jobRepository.getJobs(),
          jobRepository.getAnalyses(),
        ])
        set({ jobs, analyses })
      } catch (error) {
        if (error instanceof UnauthenticatedError) return
        console.error('[jobsStore] failed to load from Supabase', error)
      }
    },
    _subscribeRealtime: () =>
      jobRepository.subscribeToJobs({
        // Idempotent by id: replace an existing job, else prepend. This also absorbs the realtime
        // echo of this device's own writes (the row is simply replaced by an identical value).
        onUpsert: (job) =>
          set((state) => ({
            jobs: state.jobs.some((existing) => existing.id === job.id)
              ? state.jobs.map((existing) => (existing.id === job.id ? job : existing))
              : [job, ...state.jobs],
          })),
        onDelete: (id) =>
          set((state) => {
            const analyses = { ...state.analyses }
            delete analyses[id]
            return { jobs: state.jobs.filter((job) => job.id !== id), analyses }
          }),
      }),
  }),
)
