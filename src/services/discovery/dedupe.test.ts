import { describe, it, expect } from 'vitest'
import { candidateKey, normalizeUrl, dedupeCandidates } from './dedupe'
import type { DiscoveredCandidate } from '@/types/discovery'

function makeCandidate(patch: Partial<DiscoveredCandidate>): DiscoveredCandidate {
  return {
    id: 'c-1',
    company: 'Acme',
    role: 'Engineer',
    description: '',
    workMode: 'remote',
    origin: 'paste',
    sourceNote: 'test',
    foundAt: '2026-07-15T00:00:00.000Z',
    ...patch,
  }
}

describe('candidateKey', () => {
  it('normalizes case, punctuation, and whitespace', () => {
    expect(candidateKey('Acme, Inc.', 'Sr. Frontend Engineer (Remote)')).toBe(
      candidateKey('acme inc', 'sr frontend engineer   remote'),
    )
  })

  it('strips diacritics', () => {
    expect(candidateKey('Café', 'Engenheiro São Paulo')).toBe(candidateKey('Cafe', 'Engenheiro Sao Paulo'))
  })

  it('drops trailing company legal suffixes', () => {
    expect(candidateKey('Globex LLC', 'Dev')).toBe(candidateKey('Globex', 'Dev'))
    expect(candidateKey('Initech Ltda', 'Dev')).toBe(candidateKey('Initech', 'Dev'))
  })

  it('does not strip a company that IS a suffix word', () => {
    expect(candidateKey('Co', 'Dev')).toBe('co::dev')
  })
})

describe('normalizeUrl', () => {
  it('drops query params, hash, and trailing slash; lowercases host', () => {
    expect(normalizeUrl('https://Jobs.Acme.com/careers/123/?utm_source=x#apply')).toBe(
      'jobs.acme.com/careers/123',
    )
  })

  it('returns undefined for invalid or missing URLs', () => {
    expect(normalizeUrl('not a url')).toBeUndefined()
    expect(normalizeUrl(undefined)).toBeUndefined()
  })
})

describe('dedupeCandidates', () => {
  const emptyCtx = { existingJobs: [], existingCandidates: [], dismissedKeys: [] }

  it('passes through genuinely new candidates', () => {
    const result = dedupeCandidates([makeCandidate({})], emptyCtx)
    expect(result.fresh).toHaveLength(1)
  })

  it('skips duplicates of board jobs by key and by URL', () => {
    const byKey = makeCandidate({ company: 'ACME, Inc', role: 'engineer' })
    const byUrl = makeCandidate({ company: 'Other', role: 'Other role', url: 'https://a.com/jobs/1?x=1' })
    const result = dedupeCandidates([byKey, byUrl], {
      ...emptyCtx,
      existingJobs: [{ company: 'Acme', role: 'Engineer', url: 'https://a.com/jobs/1' }],
    })
    expect(result.fresh).toHaveLength(0)
    expect(result.skipped.asDuplicateOfBoard).toBe(2)
  })

  it('skips duplicates already in the queue', () => {
    const result = dedupeCandidates([makeCandidate({})], {
      ...emptyCtx,
      existingCandidates: [makeCandidate({ id: 'other' })],
    })
    expect(result.skipped.asDuplicateOfQueue).toBe(1)
  })

  it('skips previously dismissed keys', () => {
    const result = dedupeCandidates([makeCandidate({})], {
      ...emptyCtx,
      dismissedKeys: [candidateKey('Acme', 'Engineer')],
    })
    expect(result.skipped.asDismissed).toBe(1)
  })

  it('dedupes within the batch itself', () => {
    const result = dedupeCandidates([makeCandidate({ id: 'a' }), makeCandidate({ id: 'b' })], emptyCtx)
    expect(result.fresh).toHaveLength(1)
    expect(result.skipped.withinBatch).toBe(1)
  })
})
