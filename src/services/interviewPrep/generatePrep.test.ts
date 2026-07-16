import { describe, expect, it } from 'vitest'
import { generatePrep } from './generatePrep'
import type { JobAnalysis } from '@/types/analysis'
import type { JobOpportunity } from '@/types/job'
import type { CareerKnowledgeBase, KnowledgeSkill } from '@/types/resume'

const skill = (canonical: string, favorite = false): KnowledgeSkill => ({
  id: canonical.toLowerCase(),
  canonical,
  category: 'engineering',
  favorite,
  evidenceFactIds: [],
  provenance: { source: 'test', excerpt: canonical },
})

const resume: CareerKnowledgeBase = {
  schemaVersion: 3,
  profile: {
    personal: { name: 'Test User', role: 'Engineer', location: 'Remote' },
    summary: '',
    careerDirection: '',
    values: [],
    workPreferences: [],
    languages: [],
  },
  organizations: [],
  roles: [],
  initiatives: [],
  skills: [skill('React'), skill('Node.js'), skill('TypeScript')],
  facts: [],
  metrics: [],
  technicalDecisions: [],
  stories: [],
  credentials: [],
  portfolioAssets: [],
  publications: [],
  learning: [],
  unclassifiedFacts: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const job: JobOpportunity = {
  id: 'job-1',
  company: 'Acme',
  role: 'Platform Engineer',
  description: 'Build with Go, React, TypeScript, and Kubernetes.',
  workMode: 'remote',
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  archived: false,
  source: 'manual',
}

const analysis: JobAnalysis = {
  jobId: job.id,
  analyzerId: 'test',
  analyzedAt: '2026-01-01T00:00:00.000Z',
  detectedStack: [
    { term: 'React', canonical: 'React', category: 'frontend', count: 3, inResume: true, importance: 'required' },
    { term: 'Go', canonical: 'Go', category: 'backend', count: 2, inResume: false, importance: 'required' },
    { term: 'Kubernetes', canonical: 'Kubernetes', category: 'platform', count: 1, inResume: false, importance: 'preferred' },
  ],
  detectedSeniority: 'mid',
  seniorityEvidence: [],
  atsKeywords: ['React', 'Go', 'Kubernetes'],
  match: {
    atsScore: 67,
    matched: ['React'],
    missing: ['Go', 'Kubernetes'],
    categoryBreakdown: [],
    notes: [],
  },
}

describe('generatePrep', () => {
  it('prioritizes missing required skills before matched, preferred, and resume-only topics', () => {
    const prep = generatePrep(resume, job, analysis)
    const technical = prep.topics.filter((topic) => topic.category === 'technical')

    expect(technical.map((topic) => [topic.topic, topic.priority])).toEqual([
      ['Go', 'required-missing'],
      ['React', 'required-matched'],
      ['Kubernetes', 'preferred'],
      ['Node.js', 'resume-core'],
      ['TypeScript', 'resume-core'],
    ])
  })

  it('creates deterministic beginner, intermediate, and advanced questions for each technical topic', () => {
    const prep = generatePrep(resume, job, analysis)
    const technical = prep.topics.filter((topic) => topic.category === 'technical')

    expect(technical[0].questions.map((question) => question.difficulty)).toEqual([
      'beginner',
      'intermediate',
      'advanced',
    ])
    expect(technical[0].questions.map((question) => question.id)).toEqual([
      'go-beginner',
      'go-intermediate',
      'go-advanced',
    ])
    expect(technical[0].questions.every((question) => question.category === 'technical')).toBe(true)
  })

  it('composes behavioral and architecture questions alongside the technical set', () => {
    const prep = generatePrep(resume, job, analysis)
    const categories = new Set(prep.topics.map((topic) => topic.category))

    expect(categories).toEqual(new Set(['technical', 'behavioral', 'architecture']))

    const behavioral = prep.topics.filter((topic) => topic.category === 'behavioral')
    expect(behavioral.length).toBeGreaterThan(0)
    // Behavioral prompts are personalized with the target company/role.
    expect(behavioral.some((topic) => topic.questions[0].question.includes('Acme'))).toBe(true)

    const architecture = prep.topics.filter((topic) => topic.category === 'architecture')
    expect(architecture.length).toBeGreaterThan(0)
    expect(architecture[0].questions[0].expectedAnswer).toBeTruthy()
  })

  it('includes job-specific context when a selected job and analysis exist', () => {
    const prep = generatePrep(resume, job, analysis)

    expect(prep.jobContext).toEqual({
      company: 'Acme',
      role: 'Platform Engineer',
      detectedStack: ['React', 'Go', 'Kubernetes'],
      missingRequirements: ['Go', 'Kubernetes'],
      atsScore: 67,
    })
  })

  it('still produces behavioral and architecture questions with no job context', () => {
    const prep = generatePrep(resume)
    expect(prep.jobContext).toBeUndefined()
    expect(prep.topics.some((topic) => topic.category === 'behavioral')).toBe(true)
    expect(prep.topics.some((topic) => topic.category === 'architecture')).toBe(true)
  })
})
