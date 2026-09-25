import { describe, it, expect } from 'vitest'
import { getAnalyzer } from './localHeuristicAnalyzer'
import { createSeedResume } from '@/test/fixtures/sampleCareer'
import type { JobOpportunity } from '@/types/job'

const resume = createSeedResume()

const job: JobOpportunity = {
  id: 'job-1',
  company: 'Acme',
  role: 'Senior Full-Stack Engineer',
  description:
    'Senior Full-Stack Engineer with 5+ years. Requirements: React, TypeScript, Node.js, PostgreSQL. Nice to have: Rust, Kubernetes.',
  workMode: 'remote',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  archived: false,
  source: 'manual',
}

describe('LocalHeuristicAnalyzer', () => {
  it('is deterministic (ignoring the timestamp)', async () => {
    const analyzer = getAnalyzer()
    const a = await analyzer.analyze({ job, resume })
    const b = await analyzer.analyze({ job, resume })
    expect({ ...a, analyzedAt: '' }).toEqual({ ...b, analyzedAt: '' })
  })

  it('detects seniority and stamps the analyzer id', async () => {
    const analysis = await getAnalyzer().analyze({ job, resume })
    expect(analysis.detectedSeniority).toBe('senior')
    expect(analysis.analyzerId).toBe('local-heuristic-v2')
  })

  it('flags nice-to-have gaps as preferred, requirements as required', async () => {
    const analysis = await getAnalyzer().analyze({ job, resume })
    const byName = Object.fromEntries(analysis.detectedStack.map((s) => [s.canonical, s.importance]))
    expect(byName['React']).toBe('required')
    expect(byName['Rust']).toBe('preferred')
    expect(byName['Kubernetes']).toBe('preferred')
  })
})
