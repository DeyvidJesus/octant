import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Application } from '@/types/application'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { nowIso } from '@/utils/dates'

interface ApplicationsState {
  applications: Application[]
  /** Adds the application, replacing any existing one linked to the same job. */
  upsertApplication: (application: Application) => void
  updateApplication: (id: string, patch: Partial<Application>) => void
  removeApplication: (id: string) => void
}

export const useApplicationsStore = create<ApplicationsState>()(
  persist(
    (set) => ({
      applications: [],
      upsertApplication: (application) =>
        set((state) => ({
          applications: [
            application,
            ...state.applications.filter(
              (existing) => existing.jobId === undefined || existing.jobId !== application.jobId,
            ),
          ],
        })),
      updateApplication: (id, patch) =>
        set((state) => ({
          applications: state.applications.map((application) =>
            application.id === id ? { ...application, ...patch, updatedAt: nowIso() } : application,
          ),
        })),
      removeApplication: (id) =>
        set((state) => ({
          applications: state.applications.filter((application) => application.id !== id),
        })),
    }),
    {
      name: STORAGE_KEYS.applications,
      storage: appStorage,
      version: 1,
    },
  ),
)
