import { describe, it, expect } from 'vitest'
import type { DiscoveredCandidate } from '@/types/discovery'
import { countUnseen, buildDigest } from './proactivity'

function cand(id: string, foundAt: string, score?: number, role = 'Engineer', company = 'Acme'): DiscoveredCandidate {
  return { id, company, role, description: 'x', workMode: 'remote', origin: 'agent', sourceNote: '', foundAt, matchScore: score }
}

const candidates = [
  cand('a', '2026-07-22T10:00:00Z', 60),
  cand('b', '2026-07-22T12:00:00Z', 88, 'Staff Engineer', 'Beta'),
  cand('c', '2026-07-22T11:00:00Z', 70),
]

describe('countUnseen', () => {
  it('counts everything when never seen', () => {
    expect(countUnseen(candidates, null)).toBe(3)
  })
  it('counts only candidates found after lastSeenAt', () => {
    expect(countUnseen(candidates, '2026-07-22T10:30:00Z')).toBe(2)
  })
  it('is zero when all seen', () => {
    expect(countUnseen(candidates, '2026-07-22T13:00:00Z')).toBe(0)
  })
})

describe('buildDigest', () => {
  it('summarises unseen with the top match', () => {
    const digest = buildDigest(candidates, '2026-07-22T10:30:00Z')
    expect(digest).toContain('2 new opportunities')
    expect(digest).toContain('Staff Engineer at Beta (88%)') // highest-scored unseen
  })
  it('returns null when nothing new', () => {
    expect(buildDigest(candidates, '2026-07-22T13:00:00Z')).toBeNull()
  })
})
