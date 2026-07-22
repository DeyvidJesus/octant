import { describe, it, expect, vi } from 'vitest'
import type { JobAnalysis } from '@/types/analysis'
import type { DiscoveredCandidate } from '@/types/discovery'
import type { MasterResume } from '@/types/resume'
import type { SearchProfile } from '@/types/searchProfile'
import { DEFAULT_SEARCH_PROFILE } from '@/types/searchProfile'
import type { ExtractedJob } from '@/services/ai/tasks/extractJobs'
import { generateStrategies, runDiscovery, type JobSource } from './pipeline'

const profile: SearchProfile = {
  ...DEFAULT_SEARCH_PROFILE,
  targetRoles: ['Frontend Engineer', 'Full Stack Engineer'],
  seniority: 'senior',
  technologies: ['React', 'TypeScript'],
  locations: ['Remote'],
}

const longDesc = 'React, TypeScript, Node and GraphQL. '.repeat(10) // > 200 chars
const thinDesc = 'React role.'

function fakeAnalysis(atsScore: number): JobAnalysis {
  return {
    jobId: 'x', analyzerId: 'test', analyzedAt: '2026-01-01T00:00:00Z',
    detectedStack: [], detectedSeniority: 'senior', seniorityEvidence: [], atsKeywords: [],
    match: { atsScore, matched: ['React'], missing: ['GraphQL'], categoryBreakdown: [], notes: [] },
  }
}

const resume = {} as MasterResume

describe('generateStrategies', () => {
  it('creates one strategy per target role (capped at 3) with a query from the profile', () => {
    const strategies = generateStrategies(profile)
    expect(strategies).toHaveLength(2)
    expect(strategies[0].label).toBe('Frontend Engineer')
    expect(strategies[0].query).toContain('senior')
    expect(strategies[0].query).toContain('React')
    expect(strategies[0].query).toContain('Remote')
  })

  it('falls back to a default role when none are set', () => {
    const strategies = generateStrategies(DEFAULT_SEARCH_PROFILE)
    expect(strategies).toHaveLength(1)
    expect(strategies[0].label).toBe('Software Engineer')
  })
})

describe('runDiscovery', () => {
  function sourceReturning(map: Record<string, ExtractedJob[]>): JobSource {
    return { id: 'fake', search: (s) => Promise.resolve(map[s.label] ?? []) }
  }

  it('dedups across strategies, gates scoring on description length, and streams each fresh candidate', async () => {
    const shared: ExtractedJob = { company: 'Acme', role: 'Frontend Engineer', description: longDesc, workMode: 'remote' }
    const thin: ExtractedJob = { company: 'Thin Co', role: 'Frontend Engineer', description: thinDesc, workMode: 'remote' }
    const other: ExtractedJob = { company: 'Beta', role: 'Full Stack Engineer', description: longDesc, workMode: 'remote' }

    const source = sourceReturning({
      'Frontend Engineer': [shared, thin],
      'Full Stack Engineer': [shared, other], // `shared` repeats → within-run duplicate
    })
    const analyze = vi.fn().mockResolvedValue(fakeAnalysis(72))
    const streamed: DiscoveredCandidate[] = []

    const stats = await runDiscovery(
      { strategies: generateStrategies(profile), resume, dedupe: { existingJobs: [], existingCandidates: [], dismissedKeys: [] }, maxCandidates: 50 },
      { source, analyze, onCandidate: (c) => void streamed.push(c) },
    )

    // 3 unique fresh: shared, thin, other (second `shared` deduped within run).
    expect(stats.fresh).toBe(3)
    expect(stats.duplicates).toBeGreaterThanOrEqual(1)
    expect(streamed).toHaveLength(3) // streamed incrementally, one per fresh

    // Thin description was NOT scored; substantial ones were.
    const thinCandidate = streamed.find((c) => c.company === 'Thin Co')!
    expect(thinCandidate.matchScore).toBeUndefined()
    expect(thinCandidate.analysis).toBeUndefined()
    const acme = streamed.find((c) => c.company === 'Acme')!
    expect(acme.matchScore).toBe(72)
    expect(acme.analysis).toBeDefined()
    expect(acme.origin).toBe('agent')
    expect(stats.scored).toBe(2)
  })

  it('respects the maxCandidates cap', async () => {
    const many: ExtractedJob[] = Array.from({ length: 10 }, (_, i) => ({
      company: `Co${i}`, role: 'Frontend Engineer', description: longDesc, workMode: 'remote',
    }))
    const source = sourceReturning({ 'Frontend Engineer': many, 'Full Stack Engineer': [] })
    const streamed: DiscoveredCandidate[] = []
    const stats = await runDiscovery(
      { strategies: generateStrategies(profile), resume, dedupe: { existingJobs: [], existingCandidates: [], dismissedKeys: [] }, maxCandidates: 4 },
      { source, analyze: () => Promise.resolve(fakeAnalysis(50)), onCandidate: (c) => void streamed.push(c) },
    )
    expect(stats.fresh).toBe(4)
    expect(streamed).toHaveLength(4)
  })
})
