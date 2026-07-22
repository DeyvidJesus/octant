import { create } from 'zustand'
import type { CareerKnowledgeBase, MasterResume } from '@/types/resume'
import { createEmptyKnowledgeBase, initialKnowledgeBase } from '@/constants/seedData'
import { projectKnowledgeBase } from '@/services/resume/projection'
import { nowIso } from '@/utils/dates'
import { knowledgeBaseRepository } from '@/repositories/KnowledgeBaseRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from '@/repositories/persist'

interface ResumeState {
  /** Persisted source of truth. */
  knowledgeBase: CareerKnowledgeBase
  /** Runtime-only compatibility query view; never written to storage. */
  resume: MasterResume
  updateKnowledgeBase: (knowledgeBase: CareerKnowledgeBase) => void
  /** Patches specific knowledge-base collections (used by the Knowledge Base editor). */
  patchKnowledgeBase: (patch: Partial<CareerKnowledgeBase>) => void
  _fetchFromSupabase: () => Promise<void>
  /** Clears in-memory state (sign-out / user switch) so no data bleeds across sessions. */
  reset: () => void
}

function withTimestamp(knowledgeBase: CareerKnowledgeBase): CareerKnowledgeBase {
  return { ...knowledgeBase, updatedAt: nowIso() }
}

export const useResumeStore = create<ResumeState>()(
  (set, get) => {
    /**
     * What we believe is currently persisted, used to compute per-row diffs so that editing one
     * bullet writes one `resume_facts` row instead of the whole graph. `null` until the first
     * write / hydration. Advanced optimistically (persistence is fire-and-forget), consistent with
     * the rest of the store layer.
     */
    let persistedBaseline: CareerKnowledgeBase | null = null

    /** Applies a new knowledge base to state and schedules a diffed, per-row persist. */
    const commit = (knowledgeBase: CareerKnowledgeBase, context: string) => {
      set({ knowledgeBase, resume: projectKnowledgeBase(knowledgeBase) })
      const previous = persistedBaseline
      persistedBaseline = knowledgeBase
      persist(() => knowledgeBaseRepository.applyChanges(previous, knowledgeBase), context)
    }

    const initial = initialKnowledgeBase()
    return {
      knowledgeBase: initial,
      resume: projectKnowledgeBase(initial),
      updateKnowledgeBase: (next) => {
        commit(withTimestamp(next), 'resume.updateKnowledgeBase')
      },
      patchKnowledgeBase: (patch) => {
        commit(withTimestamp({ ...get().knowledgeBase, ...patch }), 'resume.patchKnowledgeBase')
      },
      _fetchFromSupabase: async () => {
        try {
          const knowledgeBase = await knowledgeBaseRepository.getKnowledgeBase()
          if (knowledgeBase) {
            persistedBaseline = knowledgeBase
            set({ knowledgeBase, resume: projectKnowledgeBase(knowledgeBase) })
          }
        } catch (error) {
          if (error instanceof UnauthenticatedError) return
          console.error('[resumeStore] failed to load from Supabase', error)
        }
      },
      reset: () => {
        persistedBaseline = null
        const empty = createEmptyKnowledgeBase()
        set({ knowledgeBase: empty, resume: projectKnowledgeBase(empty) })
      },
    }
  },
)
