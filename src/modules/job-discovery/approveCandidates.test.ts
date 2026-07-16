import { describe, it, expect } from 'vitest'
import { candidateToJob } from './approveCandidates'
import type { DiscoveredCandidate } from '@/types/discovery'

const base: DiscoveredCandidate = {
  id: 'c-1',
  company: '  Acme  ',
  role: ' Engineer ',
  description: ' A role. ',
  url: '  ',
  location: 'Remote — US',
  salaryRange: undefined,
  workMode: 'remote',
  origin: 'paste',
  sourceNote: 'test',
  foundAt: '2026-07-15T00:00:00.000Z',
}

describe('candidateToJob', () => {
  it('trims strings and coerces empty optionals to undefined', () => {
    const job = candidateToJob(base)
    expect(job.company).toBe('Acme')
    expect(job.role).toBe('Engineer')
    expect(job.description).toBe('A role.')
    expect(job.url).toBeUndefined()
    expect(job.location).toBe('Remote — US')
    expect(job.archived).toBe(false)
    expect(job.tags).toEqual([])
  })

  it('maps origin to source: paste → imported, sweep/deep-research → discovered', () => {
    expect(candidateToJob({ ...base, origin: 'paste' }).source).toBe('imported')
    expect(candidateToJob({ ...base, origin: 'sweep' }).source).toBe('discovered')
    expect(candidateToJob({ ...base, origin: 'deep-research' }).source).toBe('discovered')
  })

  it('mints a fresh id — never reuses the candidate id', () => {
    expect(candidateToJob(base).id).not.toBe(base.id)
  })
})
