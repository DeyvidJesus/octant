import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { InterviewPrepStatus, PrepQuestion } from '@/types/interviewPrep'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import {
  applyNotes,
  applyRate,
  applyRemove,
  applyStatus,
  applyToggleMastered,
  type ProgressMap,
} from '@/services/interviewPrep/progress'

/**
 * Per-question interview-prep progress. Keyed by the deterministic question id
 * so mastery survives regeneration and is portable across jobs (mastering
 * "React advanced" is job-independent by design). Denormalizes the question's
 * category/difficulty/topic so the dashboard can compute readiness without
 * re-running the generator. State updates delegate to the pure reducers in
 * services/interviewPrep/progress.ts.
 */
interface InterviewPrepState {
  tracked: ProgressMap
  /** Records a self-rated confidence (0-100), upserting the tracked question. */
  rate: (question: PrepQuestion, confidence: number) => void
  setStatus: (question: PrepQuestion, status: InterviewPrepStatus) => void
  toggleMastered: (question: PrepQuestion) => void
  setNotes: (question: PrepQuestion, notes: string) => void
  remove: (id: string) => void
}

export const useInterviewPrepStore = create<InterviewPrepState>()(
  persist(
    (set) => ({
      tracked: {},

      rate: (question, confidence) =>
        set((state) => ({ tracked: applyRate(state.tracked, question, confidence, new Date().toISOString()) })),

      setStatus: (question, status) =>
        set((state) => ({ tracked: applyStatus(state.tracked, question, status, new Date().toISOString()) })),

      toggleMastered: (question) =>
        set((state) => ({ tracked: applyToggleMastered(state.tracked, question, new Date().toISOString()) })),

      setNotes: (question, notes) =>
        set((state) => ({ tracked: applyNotes(state.tracked, question, notes, new Date().toISOString()) })),

      remove: (id) => set((state) => ({ tracked: applyRemove(state.tracked, id) })),
    }),
    {
      name: STORAGE_KEYS.interviewPrep,
      storage: appStorage,
      version: 1,
    },
  ),
)
