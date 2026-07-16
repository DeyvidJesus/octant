import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { TailoredResume } from '@/types/generator'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'

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
}

export const useGeneratorStore = create<GeneratorState>()(
  persist(
    (set) => ({
      tailored: {},

      saveTailored: (resume) =>
        set((state) => ({ tailored: { ...state.tailored, [resume.jobId]: resume } })),

      removeTailored: (jobId) =>
        set((state) => {
          const tailored = { ...state.tailored }
          delete tailored[jobId]
          return { tailored }
        }),

      toggleBullet: (jobId, accomplishmentId) =>
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
        }),

      toggleProject: (jobId, projectId) =>
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
        }),
    }),
    {
      name: STORAGE_KEYS.generated,
      storage: appStorage,
      version: 1,
    },
  ),
)
