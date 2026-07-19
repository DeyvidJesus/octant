import { create } from 'zustand'
import type { TailoredResume } from '@/types/generator'
import { generatorRepository } from '@/repositories/GeneratorRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from '@/repositories/persist'

/**
 * Tailored resumes, one per job. Documents are snapshots — regenerating from
 * the Master Resume replaces them. Toggles flip `included` flags in place so
 * a curation session survives reloads.
 */
interface GeneratorState {
  tailored: Record<string, TailoredResume>
  saveTailored: (resume: TailoredResume) => void
  removeTailored: (jobId: string) => void
  toggleBullet: (jobId: string, accomplishmentId: string) => void
  toggleProject: (jobId: string, projectId: string) => void
  _fetchFromSupabase: () => Promise<void>
}

export const useGeneratorStore = create<GeneratorState>()(
  (set, get) => ({
    tailored: {},

    saveTailored: (resume) => {
      set((state) => ({ tailored: { ...state.tailored, [resume.jobId]: resume } }))
      persist(() => generatorRepository.saveTailored(get().tailored), 'generator.saveTailored')
    },

    removeTailored: (jobId) => {
      set((state) => {
        const tailored = { ...state.tailored }
        delete tailored[jobId]
        return { tailored }
      })
      persist(() => generatorRepository.saveTailored(get().tailored), 'generator.removeTailored')
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
      persist(() => generatorRepository.saveTailored(get().tailored), 'generator.toggleBullet')
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
      persist(() => generatorRepository.saveTailored(get().tailored), 'generator.toggleProject')
    },

    _fetchFromSupabase: async () => {
      try {
        const tailored = await generatorRepository.getTailored()
        if (tailored) {
          set({ tailored })
        }
      } catch (error) {
        if (error instanceof UnauthenticatedError) return
        console.error('[generatorStore] failed to load from Supabase', error)
      }
    },
  }),
)
