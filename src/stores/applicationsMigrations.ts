import type { Application, ApplicationEvent } from '@/types/application'
import { createId } from '@/utils/id'

export interface PersistedApplications {
  applications: Application[]
}

/**
 * v1 → v2: the `events` timeline became a required field. Backfill it by
 * synthesizing a `created` event from `createdAt` so every application has an
 * anchor entry, and default optional flags.
 */
export function migrateApplicationsState(persisted: unknown, fromVersion: number): PersistedApplications {
  if (fromVersion >= 2) return persisted as PersistedApplications
  const old = persisted as { applications?: Application[] } | undefined
  const applications = (old?.applications ?? []).map((application) => {
    const events: ApplicationEvent[] =
      application.events && application.events.length > 0
        ? application.events
        : [{ id: createId(), at: application.createdAt, kind: 'created' }]
    return { ...application, events }
  })
  return { applications }
}
