import { create } from 'zustand'
import type { Application, ApplicationEvent, ApplicationStage } from '@/types/application'
import { nowIso } from '@/utils/dates'
import { appendEvent, changeStage } from '@/services/applications/events'
import { applicationRepository } from '@/repositories/ApplicationRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from './persist'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'

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
  _fetchFromSupabase: () => Promise<void>
  /** Subscribes to cross-device changes; returns an unsubscribe function. */
  _subscribeRealtime: () => () => void
  /** Clears in-memory state (sign-out / user switch) so no data bleeds across sessions. */
  reset: () => void
}

export const useApplicationsStore = create<ApplicationsState>()(
  (set, get) => ({
    applications: [],
    upsertApplication: (application) => {
      set((state) => ({
        applications: [
          application,
          ...state.applications.filter(
            (existing) => existing.jobId === undefined || existing.jobId !== application.jobId,
          ),
        ],
      }))
      trackEvent(AnalyticsEvent.ApplicationCreated, { stage: application.stage })
      if (application.stage === 'applied') trackEvent(AnalyticsEvent.JobApplied, { id: application.id })
      persist(() => applicationRepository.upsertApplication(application), 'applications.upsert', {
        reconcile: () => void get()._fetchFromSupabase(),
      })
    },
    updateApplication: (id, patch) => {
      set((state) => ({
        applications: state.applications.map((application) =>
          application.id === id ? { ...application, ...patch, updatedAt: nowIso() } : application,
        ),
      }))
      const app = get().applications.find((a) => a.id === id)
      if (app) persist(() => applicationRepository.upsertApplication(app), 'applications.update')
    },
    removeApplication: (id) => {
      set((state) => ({
        applications: state.applications.filter((application) => application.id !== id),
      }))
      persist(() => applicationRepository.deleteApplication(id), 'applications.remove')
    },
    moveStage: (id, toStage) => {
      set((state) => ({
        applications: state.applications.map((application) => {
          if (application.id !== id) return application
          const patch = changeStage(application, toStage, nowIso())
          if (Object.keys(patch).length === 0) return application
          return { ...application, ...patch, updatedAt: nowIso() }
        }),
      }))
      const app = get().applications.find((a) => a.id === id)
      if (toStage === 'applied') trackEvent(AnalyticsEvent.JobApplied, { id })
      if (app) persist(() => applicationRepository.upsertApplication(app), 'applications.moveStage')
    },
    addEvent: (id, event) => {
      set((state) => ({
        applications: state.applications.map((application) =>
          application.id === id
            ? { ...application, events: appendEvent(application.events, event), updatedAt: nowIso() }
            : application,
        ),
      }))
      const app = get().applications.find((a) => a.id === id)
      if (app) persist(() => applicationRepository.upsertApplication(app), 'applications.addEvent')
    },
    _fetchFromSupabase: async () => {
      try {
        const applications = await applicationRepository.getApplications()
        set({ applications })
      } catch (error) {
        if (error instanceof UnauthenticatedError) return
        console.error('[applicationsStore] failed to load from Supabase', error)
      }
    },
    _subscribeRealtime: () =>
      applicationRepository.subscribeToApplications({
        // Idempotent by id: replace an existing application, else prepend. Absorbs the realtime echo
        // of this device's own writes.
        onUpsert: (application) =>
          set((state) => ({
            applications: state.applications.some((existing) => existing.id === application.id)
              ? state.applications.map((existing) => (existing.id === application.id ? application : existing))
              : [application, ...state.applications],
          })),
        onDelete: (id) =>
          set((state) => ({
            applications: state.applications.filter((application) => application.id !== id),
          })),
      }),
    reset: () => set({ applications: [] }),
  }),
)
