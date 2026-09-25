import { create } from 'zustand'
import type { TailoredResume } from '@/types/generator'
import { tailoredResumeRepository } from '@/repositories/TailoredResumeRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from './persist'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'

/** Tailored resumes, one per job. Regenerating replaces the snapshot; toggles persist `included` flags. */
interface GeneratorState {
  tailored: Record<string, TailoredResume>
  saveTailored: (resume: TailoredResume) => void
  removeTailored: (jobId: string) => void
  toggleBullet: (jobId: string, accomplishmentId: string) => void
  toggleProject: (jobId: string, projectId: string) => void
  _fetchFromSupabase: () => Promise<void>
  /** Clears in-memory state (sign-out / user switch) so no data bleeds across sessions. */
  reset: () => void
}

export const useGeneratorStore = create<GeneratorState>()(
  (set, get) => ({
    tailored: {},

    saveTailored: (resume) => {
      set((state) => ({ tailored: { ...state.tailored, [resume.jobId]: resume } }))
      trackEvent(AnalyticsEvent.ResumeGenerated, { jobId: resume.jobId })
      persist(() => tailoredResumeRepository.saveTailored(resume), 'generator.saveTailored')
    },

    removeTailored: (jobId) => {
      set((state) => {
        const tailored = { ...state.tailored }
        delete tailored[jobId]
        return { tailored }
      })
      persist(() => tailoredResumeRepository.deleteTailored(jobId), 'generator.removeTailored')
    },

    toggleBullet: (jobId, accomplishmentId) => {
      set((state) => {
        const doc = state.tailored[jobId]
        if (!doc) return state
        const flip = <T extends { accomplishmentId: string; included: boolean }>(bullets: T[]): T[] =>
          bullets.map((bullet) =>
            bullet.accomplishmentId === accomplishmentId ? { ...bullet, included: !bullet.included } : bullet,
          )
        return {
          tailored: {
            ...state.tailored,
            [jobId]: {
              ...doc,
              experience: doc.experience.map((entry) => ({ ...entry, bullets: flip(entry.bullets) })),
              projects: doc.projects.map((project) => ({ ...project, bullets: flip(project.bullets) })),
            },
          },
        }
      })
      const doc = get().tailored[jobId]
      if (doc) persist(() => tailoredResumeRepository.saveTailored(doc), 'generator.toggleBullet')
    },

    toggleProject: (jobId, projectId) => {
      set((state) => {
        const doc = state.tailored[jobId]
        if (!doc) return state
        return {
          tailored: {
            ...state.tailored,
            [jobId]: {
              ...doc,
              projects: doc.projects.map((project) =>
                project.projectId === projectId ? { ...project, included: !project.included } : project,
              ),
            },
          },
        }
      })
      const doc = get().tailored[jobId]
      if (doc) persist(() => tailoredResumeRepository.saveTailored(doc), 'generator.toggleProject')
    },

    _fetchFromSupabase: async () => {
      try {
        set({ tailored: await tailoredResumeRepository.getTailored() })
      } catch (error) {
        if (error instanceof UnauthenticatedError) return
        console.error('[generatorStore] failed to load from Supabase', error)
      }
    },
    reset: () => set({ tailored: {} }),
  }),
)
