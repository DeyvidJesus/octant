import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MasterResume } from '@/types/resume'
import { createSeedResume } from '@/constants/seedData'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { nowIso } from '@/utils/dates'

interface ResumeState {
  resume: MasterResume
  updateResume: (patch: Partial<MasterResume>) => void
}

export const useResumeStore = create<ResumeState>()(
  persist(
    (set) => ({
      resume: createSeedResume(),
      updateResume: (patch) =>
        set((state) => ({
          resume: { ...state.resume, ...patch, updatedAt: nowIso() },
        })),
    }),
    {
      name: STORAGE_KEYS.resume,
      storage: appStorage,
      version: 1,
    },
  ),
)
