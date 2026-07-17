import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CareerKnowledgeBase, MasterResume } from '@/types/resume'
import { createSeedKnowledgeBase } from '@/constants/seedData'
import { projectKnowledgeBase } from '@/services/resume/projection'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { nowIso } from '@/utils/dates'
import { migrateResumeState, migrateV2ToV3 } from './resumeMigrations'

interface ResumeState {
  /** Persisted source of truth. */
  knowledgeBase: CareerKnowledgeBase
  /** Runtime-only compatibility query view; never written to storage. */
  resume: MasterResume
  updateKnowledgeBase: (knowledgeBase: CareerKnowledgeBase) => void
  /** Patches specific knowledge-base collections (used by the Knowledge Base editor). */
  patchKnowledgeBase: (patch: Partial<CareerKnowledgeBase>) => void
  /** @deprecated Compatibility bridge for the existing editor. */
  updateResume: (patch: Partial<MasterResume>) => void
}

function withTimestamp(knowledgeBase: CareerKnowledgeBase): CareerKnowledgeBase {
  return { ...knowledgeBase, updatedAt: nowIso() }
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set) => {
      const knowledgeBase = createSeedKnowledgeBase()
      return {
        knowledgeBase,
        resume: projectKnowledgeBase(knowledgeBase),
        updateKnowledgeBase: (next) => {
          const knowledgeBase = withTimestamp(next)
          set({ knowledgeBase, resume: projectKnowledgeBase(knowledgeBase) })
        },
        patchKnowledgeBase: (patch) =>
          set((state) => {
            const knowledgeBase = withTimestamp({ ...state.knowledgeBase, ...patch })
            return { knowledgeBase, resume: projectKnowledgeBase(knowledgeBase) }
          }),
        updateResume: (patch) => set((state) => {
          const projected = { ...state.resume, ...patch, updatedAt: nowIso() }
          const migrated = migrateV2ToV3(projected)
          // Keep knowledge which the legacy projection cannot edit or display.
          const knowledgeBase = {
            ...migrated,
            profile: { ...migrated.profile, philosophy: state.knowledgeBase.profile.philosophy, workPreferences: state.knowledgeBase.profile.workPreferences },
            technicalDecisions: state.knowledgeBase.technicalDecisions,
            unclassifiedFacts: state.knowledgeBase.unclassifiedFacts,
            facts: [...migrated.facts, ...state.knowledgeBase.facts.filter((fact) => fact.status !== 'confirmed')],
          }
          return { knowledgeBase, resume: projectKnowledgeBase(knowledgeBase) }
        }),
      }
    },
    {
      name: STORAGE_KEYS.resume,
      storage: appStorage,
      version: 3,
      partialize: (state) => ({ knowledgeBase: state.knowledgeBase }),
      migrate: (persisted, version) => migrateResumeState(persisted, version),
      merge: (persisted, current) => {
        const knowledgeBase = (persisted as { knowledgeBase: CareerKnowledgeBase }).knowledgeBase
        return { ...current, knowledgeBase, resume: projectKnowledgeBase(knowledgeBase) }
      },
    },
  ),
)
