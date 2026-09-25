import { describe, it, expect } from 'vitest'
import { buildUserPrompt } from './explainMatch'
import type { JobAnalysis } from '@/types/analysis'
import type { JobOpportunity } from '@/types/job'
import { createSeedResume } from '@/test/fixtures/sampleCareer'

const job: JobOpportunity = {
  id: 'job-1',
  company: 'Acme',
  role: 'Software Engineer',
  description: '',
  workMode: 'remote',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  archived: false,
  source: 'manual',
}

const analysis: JobAnalysis = {
  jobId: 'job-1',
  analyzerId: 'local-heuristic-v2',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  detectedStack: [
    { term: 'react', canonical: 'React', category: 'frontend', count: 3, inResume: true, importance: 'required' },
    { term: 'go', canonical: 'Go', category: 'backend', count: 2, inResume: false, importance: 'required' },
    { term: 'kubernetes', canonical: 'Kubernetes', category: 'devops', count: 1, inResume: false, importance: 'preferred' },
  ],
  detectedSeniority: 'mid',
  seniorityEvidence: ['"3+ years"'],
  atsKeywords: ['React', 'Go', 'Kubernetes'],
  match: {
    atsScore: 60,
    matched: ['React'],
    missing: ['Go', 'Kubernetes'],
    categoryBreakdown: [],
    notes: [],
  },
}

describe('buildUserPrompt', () => {
  const prompt = buildUserPrompt({ job, resume: createSeedResume(), analysis })

  it('reports the strengths from matched skills', () => {
    expect(prompt).toContain('STRENGTHS')
    expect(prompt).toContain('React')
  })

  it('separates missing must-haves from nice-to-haves by importance', () => {
    expect(prompt).toMatch(/MISSING MUST-HAVES.*Go/)
    expect(prompt).toMatch(/MISSING NICE-TO-HAVES.*Kubernetes/)
  })

  it('includes the ATS score and detected seniority', () => {
    expect(prompt).toContain('ATS KEYWORD COVERAGE: 60%')
    expect(prompt).toContain('DETECTED SENIORITY: mid')
  })
})
