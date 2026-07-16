import { describe, it, expect } from 'vitest'
import { scoreCandidates, MIN_SCORABLE_DESCRIPTION } from './scoreCandidates'
import { createSeedResume } from '@/constants/seedData'
import type { DiscoveredCandidate } from '@/types/discovery'

const resume = createSeedResume()

function makeCandidate(description: string): DiscoveredCandidate {
  return {
    id: 'c-1',
    company: 'Acme',
    role: 'Full Stack Engineer',
    description,
    workMode: 'remote',
    origin: 'paste',
    sourceNote: 'test',
    foundAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('scoreCandidates', () => {
  it('scores candidates with substantial descriptions', async () => {
    const description =
      'We are hiring a Full Stack Engineer. Requirements: React, TypeScript, Node.js, PostgreSQL, ' +
      'and experience with cloud infrastructure on AWS. You will build product features end to end, ' +
      'own quality, and collaborate with design and product on a modern web platform.'
    expect(description.length).toBeGreaterThanOrEqual(MIN_SCORABLE_DESCRIPTION)

    const [scored] = await scoreCandidates([makeCandidate(description)], resume)
    expect(scored.matchScore).toBeTypeOf('number')
    expect(scored.matchScore).toBeGreaterThan(0)
  })

  it('leaves thin descriptions unscored — no fake numbers from snippets', async () => {
    const [scored] = await scoreCandidates([makeCandidate('React role at Acme.')], resume)
    expect(scored.matchScore).toBeUndefined()
  })
})
