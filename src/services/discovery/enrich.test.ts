import { describe, it, expect } from 'vitest'
import type { JobAnalysis } from '@/types/analysis'
import type { DiscoveredCandidate } from '@/types/discovery'
import { buildRecommendation } from './enrich'

function candidate(score: number | undefined, missingRequired: string[]): DiscoveredCandidate {
  const analysis: JobAnalysis = {
    jobId: 'j', analyzerId: 'test', analyzedAt: '2026-01-01T00:00:00Z',
    detectedStack: missingRequired.map((c) => ({ term: c, canonical: c, category: 'x', count: 1, inResume: false, importance: 'required' as const })),
    detectedSeniority: 'senior', seniorityEvidence: [], atsKeywords: [],
    match: { atsScore: score ?? 0, matched: [], missing: missingRequired, categoryBreakdown: [], notes: [] },
  }
  return { id: 'c', company: 'Acme', role: 'Engineer', description: 'x', workMode: 'remote', origin: 'agent', sourceNote: '', foundAt: '', matchScore: score, analysis }
}

describe('buildRecommendation', () => {
  it('recommends applying for a strong match with no gaps', () => {
    expect(buildRecommendation(candidate(82, []))).toMatch(/apply now/i)
  })

  it('recommends a tailored application, naming gaps, for a mid match', () => {
    const rec = buildRecommendation(candidate(64, ['Kubernetes', 'Go']))
    expect(rec).toMatch(/tailored application/i)
    expect(rec).toContain('Kubernetes')
  })

  it('recommends upskilling for a low match with missing must-haves', () => {
    expect(buildRecommendation(candidate(40, ['Rust']))).toMatch(/upskilling in Rust/i)
  })

  it('handles an unscored candidate (no analysis) gracefully', () => {
    const c = { id: 'c', company: 'A', role: 'R', description: 'x', workMode: 'remote', origin: 'agent', sourceNote: '', foundAt: '' } as DiscoveredCandidate
    expect(buildRecommendation(c)).toMatch(/full job description/i)
  })
})
