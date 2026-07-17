import { describe, expect, it } from 'vitest'
import { migrateApplicationsState } from './applicationsMigrations'
import type { Application } from '@/types/application'

const baseApp = (overrides: Partial<Application> = {}): Application => ({
  id: 'app-1',
  company: 'Acme',
  role: 'Engineer',
  workMode: 'remote',
  stage: 'applied',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  links: [],
  notes: '',
  events: [],
  ...overrides,
})

describe('migrateApplicationsState', () => {
  it('backfills a synthesized created event on v1 data missing events', () => {
    // Simulate a v1 record with no events field at all.
    const legacy = { applications: [{ ...baseApp(), events: undefined as unknown as [] }] }
    const migrated = migrateApplicationsState(legacy, 1)

    expect(migrated.applications).toHaveLength(1)
    const events = migrated.applications[0].events
    expect(events).toHaveLength(1)
    expect(events[0].kind).toBe('created')
    expect(events[0].at).toBe('2026-01-01T00:00:00.000Z')
  })

  it('preserves existing events on v1 data that already has them', () => {
    const withEvents = {
      applications: [baseApp({ events: [{ id: 'e1', at: '2026-01-01T00:00:00.000Z', kind: 'note', text: 'hi' }] })],
    }
    const migrated = migrateApplicationsState(withEvents, 1)
    expect(migrated.applications[0].events).toEqual(withEvents.applications[0].events)
  })

  it('passes current-version state through untouched', () => {
    const state = { applications: [baseApp({ events: [{ id: 'e1', at: 'x', kind: 'created' }] })] }
    expect(migrateApplicationsState(state, 2)).toBe(state)
  })

  it('tolerates undefined and empty persisted state', () => {
    expect(migrateApplicationsState(undefined, 1)).toEqual({ applications: [] })
    expect(migrateApplicationsState({}, 1)).toEqual({ applications: [] })
  })
})
