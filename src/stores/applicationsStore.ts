import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Application, ApplicationEvent, ApplicationStage } from '@/types/application'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { nowIso } from '@/utils/dates'
import { appendEvent, changeStage } from '@/services/applications/events'
import { migrateApplicationsState } from './applicationsMigrations'

interface ApplicationsState {
  applications: Application[]
  /** Adds the application, replacing any existing one linked to the same job. */
  upsertApplication: (application: Application) => void
  updateApplication: (id: string, patch: Partial<Application>) => void
  removeApplication: (id: string) => void
  /** Moves an application to a new stage and records a timeline event. */
  moveStage: (id: string, toStage: ApplicationStage) => void
  /** Appends a pre-built event (note/contact) to an application's timeline. */
  addEvent: (id: string, event: ApplicationEvent) => void
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
      moveStage: (id, toStage) =>
        set((state) => ({
          applications: state.applications.map((application) => {
            if (application.id !== id) return application
            const patch = changeStage(application, toStage, nowIso())
            if (Object.keys(patch).length === 0) return application
            return { ...application, ...patch, updatedAt: nowIso() }
          }),
        })),
      addEvent: (id, event) =>
        set((state) => ({
          applications: state.applications.map((application) =>
            application.id === id
              ? { ...application, events: appendEvent(application.events, event), updatedAt: nowIso() }
              : application,
          ),
        })),
    }),
    {
      name: STORAGE_KEYS.applications,
      storage: appStorage,
      version: 2,
      migrate: (persisted, version) => migrateApplicationsState(persisted, version),
    },
  ),
)
