import { describe, it, expect } from 'vitest'
import { generateTailoredResume } from './generate'
import { buildJdWeights, scoreAccomplishment } from './score'
import { computeCoverage } from './coverage'
import { toMarkdown, toPlainText } from './markdown'
import type { JobAnalysis, DetectedSkill } from '@/types/analysis'
import type { Accomplishment, MasterResume } from '@/types/resume'

function detected(canonical: string, count: number, importance: 'required' | 'preferred', inResume = true): DetectedSkill {
  return { term: canonical.toLowerCase(), canonical, category: 'frontend', count, inResume, importance }
}

const analysis: JobAnalysis = {
  jobId: 'job-1',
  analyzerId: 'local-heuristic-v2',
  analyzedAt: '2026-07-15T00:00:00.000Z',
  detectedStack: [
    detected('React', 3, 'required'),
    detected('TypeScript', 2, 'required'),
    detected('GraphQL', 1, 'preferred'),
    detected('Kubernetes', 2, 'required', false),
  ],
  detectedSeniority: 'mid',
  seniorityEvidence: [],
  atsKeywords: ['React', 'TypeScript', 'GraphQL', 'Kubernetes'],
  match: { atsScore: 70, matched: ['React', 'TypeScript', 'GraphQL'], missing: ['Kubernetes'], categoryBreakdown: [], notes: [] },
}

function acc(id: string, text: string, skills: string[] = [], metric?: string): Accomplishment {
  return { id, text, skills, metric, keywords: [] }
}

const resume: MasterResume = {
  personal: {
    name: 'Deyvid G.',
    role: 'Software Engineer',
    location: 'Brazil',
    email: 'd@example.com',
    github: 'https://github.com/deyvid',
  },
  summary: 'Product-minded engineer building with React and TypeScript.',
  goals: 'International role',
  values: [],
  experience: [
    {
      id: 'exp-1',
      company: 'Econverse',
      role: 'Software Engineer',
      duration: '2023 – Present',
      accomplishments: [
        acc('a1', 'Migrated legacy PHP forms to a new stack'),
        acc('a2', 'Built a React design system used by 4 teams', ['React', 'TypeScript'], 'cut UI dev time 30%'),
        acc('a3', 'Optimized GraphQL resolvers', ['GraphQL'], 'p95 latency -45%'),
        acc('a4', 'Wrote internal docs portal'),
        acc('a5', 'Introduced TypeScript strict mode across repos', ['TypeScript']),
      ],
    },
  ],
  projects: [
    {
      id: 'p1',
      name: 'GoMech',
      tech: ['React', 'TypeScript', 'PostgreSQL'],
      description: 'Multi-tenant SaaS for workshop management.',
      accomplishments: [acc('pa1', 'Designed multi-tenant data model', ['PostgreSQL'])],
    },
    {
      id: 'p2',
      name: 'DotfilesBot',
      tech: ['Rust'],
      description: 'CLI tool for dotfile sync.',
      accomplishments: [],
    },
    {
      id: 'p3',
      name: 'ShopSync',
      tech: ['React', 'GraphQL'],
      description: 'Storefront sync engine.',
      accomplishments: [],
    },
  ],
  skills: [
    { id: 's1', canonical: 'React', category: 'Frontend', proficiency: 5 },
    { id: 's2', canonical: 'TypeScript', category: 'Frontend', proficiency: 5 },
    { id: 's3', canonical: 'Vue', category: 'Frontend', proficiency: 2 },
    { id: 's4', canonical: 'GraphQL', category: 'Backend', proficiency: 4 },
    { id: 's5', canonical: 'Java', category: 'Backend', proficiency: 3 },
  ],
  stories: [],
  certifications: [{ id: 'c1', name: 'AWS CCP', issuer: 'AWS' }],
  education: [{ id: 'e1', institution: 'UFX', degree: 'BSc', field: 'Computer Science', start: '2019', end: '2023' }],
  publications: [],
  learning: [],
  portfolio: [],
  languages: [{ id: 'l1', name: 'English', level: 'Fluent' }],
  updatedAt: '2026-07-01T00:00:00.000Z',
}

describe('scoreAccomplishment', () => {
  const weights = buildJdWeights(analysis)

  it('weights required skills double and sums matches', () => {
    // a2: React (3×2=6) + TypeScript (2×2=4) = 10
    expect(scoreAccomplishment(resume.experience[0].accomplishments[1], weights)).toBe(10)
    // a3: GraphQL preferred (1×1=1)
    expect(scoreAccomplishment(resume.experience[0].accomplishments[2], weights)).toBe(1)
  })

  it('scores from text mentions even without curated tags', () => {
    const untagged = acc('x', 'Shipped React features weekly')
    expect(scoreAccomplishment(untagged, weights)).toBe(6)
  })
})

describe('generateTailoredResume', () => {
  const tailored = generateTailoredResume(resume, analysis)

  it('is deterministic (ignoring the timestamp)', () => {
    const again = generateTailoredResume(resume, analysis)
    expect({ ...tailored, generatedAt: '' }).toEqual({ ...again, generatedAt: '' })
  })

  it('includes the top-relevance bullets and orders them first', () => {
    const bullets = tailored.experience[0].bullets
    // Ranked: a2 (10), a5 (4), a3 (1), then zero-score by authored order (a1, a4).
    expect(bullets.map((b) => b.accomplishmentId)).toEqual(['a2', 'a5', 'a3', 'a1', 'a4'])
    // Only relevant bullets are included (zero-score ones pad only up to the 2-bullet floor).
    expect(bullets.filter((b) => b.included).map((b) => b.accomplishmentId)).toEqual(['a2', 'a5', 'a3'])
  })

  it('never leaves a role empty even for an unrelated job', () => {
    const unrelated: JobAnalysis = { ...analysis, detectedStack: [detected('COBOL', 5, 'required', false)] }
    const result = generateTailoredResume(resume, unrelated)
    expect(result.experience[0].bullets.filter((b) => b.included)).toHaveLength(2)
  })

  it('includes only the top 2 projects, preserving authored order', () => {
    const included = tailored.projects.filter((p) => p.included).map((p) => p.projectId)
    expect(included).toEqual(['p1', 'p3']) // GoMech + ShopSync outrank the Rust CLI
    expect(tailored.projects.map((p) => p.projectId)).toEqual(['p1', 'p2', 'p3'])
  })

  it('puts matched skills first and caps unmatched noise', () => {
    const frontend = tailored.skillGroups.find((g) => g.category === 'Frontend')
    expect(frontend?.skills.map((s) => s.canonical)).toEqual(['React', 'TypeScript', 'Vue'])
    expect(frontend?.skills.map((s) => s.matched)).toEqual([true, true, false])
  })

  it('records source ids and the resume timestamp for staleness', () => {
    expect(tailored.resumeUpdatedAt).toBe(resume.updatedAt)
    expect(tailored.experience[0].experienceId).toBe('exp-1')
    for (const bullet of tailored.experience[0].bullets) {
      expect(resume.experience[0].accomplishments.some((a) => a.id === bullet.accomplishmentId)).toBe(true)
    }
  })
})

describe('computeCoverage', () => {
  it('scores only included content and lists gaps', () => {
    const tailored = generateTailoredResume(resume, analysis)
    const coverage = computeCoverage(tailored, analysis)
    // React/TypeScript/GraphQL present; Kubernetes not in the resume at all.
    expect(coverage.covered).toEqual(expect.arrayContaining(['React', 'TypeScript', 'GraphQL']))
    expect(coverage.missing).toEqual(['Kubernetes'])
    // Weights: total = 6+4+1+4 = 15, covered = 11 → 73%.
    expect(coverage.score).toBe(73)
  })

  it('drops coverage when the covering bullet is excluded', () => {
    const tailored = generateTailoredResume(resume, analysis)
    for (const exp of tailored.experience) {
      for (const bullet of exp.bullets) {
        if (bullet.accomplishmentId === 'a3') bullet.included = false
      }
    }
    // GraphQL still appears in skills + ShopSync tech, so exclude those too.
    tailored.skillGroups = tailored.skillGroups.map((g) => ({
      ...g,
      skills: g.skills.filter((s) => s.canonical !== 'GraphQL'),
    }))
    tailored.projects = tailored.projects.map((p) => (p.projectId === 'p3' ? { ...p, included: false } : p))
    const coverage = computeCoverage(tailored, analysis)
    expect(coverage.missing).toEqual(expect.arrayContaining(['GraphQL', 'Kubernetes']))
  })
})

describe('exporters', () => {
  const tailored = generateTailoredResume(resume, analysis)

  it('markdown contains only included bullets', () => {
    const md = toMarkdown(tailored)
    expect(md).toContain('# Deyvid G.')
    expect(md).toContain('Built a React design system')
    expect(md).toContain('(cut UI dev time 30%)')
    expect(md).not.toContain('docs portal') // a4 excluded (rank 5)
    expect(md).not.toContain('DotfilesBot') // project not included
  })

  it('plain text has no markdown syntax', () => {
    const text = toPlainText(tailored)
    expect(text).not.toMatch(/[#*]|\]\(/)
    expect(text).toContain('GitHub — https://github.com/deyvid')
  })
})
