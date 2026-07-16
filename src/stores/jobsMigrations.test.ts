import { describe, it, expect } from 'vitest'
import { migrateJobsState, type PersistedJobs } from './jobsMigrations'

const v1Job = {
  id: 'job-1',
  company: 'Acme',
  role: 'Engineer',
  description: 'desc',
  workMode: 'remote' as const,
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  archived: false,
}

describe('migrateJobsState', () => {
  it('fills source: manual on v1 jobs', () => {
    const migrated = migrateJobsState({ jobs: [v1Job], analyses: {} }, 1)
    expect(migrated.jobs[0].source).toBe('manual')
  })

  it('passes v2 state through untouched', () => {
    const state: PersistedJobs = {
      jobs: [{ ...v1Job, source: 'discovered' }],
      analyses: {},
    }
    expect(migrateJobsState(state, 2)).toBe(state)
  })

  it('tolerates empty/undefined persisted state', () => {
    expect(migrateJobsState(undefined, 1)).toEqual({ jobs: [], analyses: {} })
    expect(migrateJobsState({}, 1)).toEqual({ jobs: [], analyses: {} })
  })
})
