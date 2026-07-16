import { describe, expect, it } from 'vitest'
import { createSeedKnowledgeBase, createSeedResume } from '@/constants/seedData'
import { projectKnowledgeBase } from '@/services/resume/projection'
import { migrateResumeState, migrateV2ToV3 } from './resumeMigrations'

const v1State = {
  resume: {
    personal: { name: 'Deyvid', role: 'Engineer', location: 'Brazil', english: 'C1' },
    summary: 'Summary text', goals: 'Goals text', values: ['clean code'],
    experience: [{ id: 'e1', company: 'Econverse', role: 'SWE', duration: '2024-Present', bullets: ['Built React apps', 'Improved SEO'] }],
    projects: [{ id: 'p1', name: 'GoMech', tech: ['Java'], description: 'SaaS', bullets: ['Multi-tenant backend'] }],
    skills: [{ label: 'Frontend', skills: ['React', 'TypeScript'] }], updatedAt: '2026-01-01T00:00:00.000Z',
  },
}

describe('knowledge-base migration and projection', () => {
  it('semantically migrates v1 data and preserves unclassified source text for review', () => {
    const knowledgeBase = migrateResumeState(v1State, 1).knowledgeBase
    expect(knowledgeBase.schemaVersion).toBe(3)
    expect(knowledgeBase.roles[0]).toMatchObject({ id: 'e1', title: 'SWE', period: '2024-Present' })
    expect(knowledgeBase.skills.map((entry) => entry.canonical)).toEqual(['React', 'TypeScript'])
    expect(knowledgeBase.profile.languages.some((entry) => entry.name === 'English' && entry.level === 'C1')).toBe(true)
    expect(knowledgeBase.facts.some((entry) => entry.statement === 'Built React apps')).toBe(true)
    expect(knowledgeBase.unclassifiedFacts).toContainEqual(expect.objectContaining({ rawText: 'Multi-tenant backend', status: 'needs_review' }))
  })

  it('migrates the former v2 seed to normalized facts without losing its visible claims', () => {
    const v3 = migrateV2ToV3(createSeedResume())
    const statements = v3.facts.map((entry) => entry.statement)
    expect(statements).toContain('Develop and maintain enterprise Headless Commerce applications using React and Next.js.')
    expect(statements).toContain('Architected a multi-tenant backend using Java and Spring Boot with PostgreSQL.')
    expect(v3.profile.summary).toContain('Software Engineer')
  })

  it('passes through persisted v3 data unchanged', () => {
    const v3 = { knowledgeBase: createSeedKnowledgeBase() }
    expect(migrateResumeState(v3, 3)).toBe(v3)
  })

  it('falls back to the expanded knowledge-base seed when no state exists', () => {
    const knowledgeBase = migrateResumeState({}, 2).knowledgeBase
    expect(knowledgeBase.profile.personal.name).toBe('Deyvid Gondim')
    expect(knowledgeBase.facts.length).toBeGreaterThan(15)
  })

  it('projects only confirmed facts and keeps TODO/review content out of resume output', () => {
    const knowledgeBase = createSeedKnowledgeBase()
    const projection = projectKnowledgeBase(knowledgeBase)
    const text = projection.experience.flatMap((entry) => entry.accomplishments).map((entry) => entry.text).join('\n')
    expect(text).toContain('Develop and maintain enterprise Headless Commerce applications using React and Next.js.')
    expect(text).not.toContain('TODO:')
    expect(text).not.toContain('Add all professional experiences')
  })

  it('keeps every normalized reference resolvable', () => {
    const knowledgeBase = createSeedKnowledgeBase()
    const roleIds = new Set(knowledgeBase.roles.map((entry) => entry.id))
    const initiativeIds = new Set(knowledgeBase.initiatives.map((entry) => entry.id))
    const skillIds = new Set(knowledgeBase.skills.map((entry) => entry.id))
    const factIds = new Set(knowledgeBase.facts.map((entry) => entry.id))
    const metricIds = new Set(knowledgeBase.metrics.map((entry) => entry.id))
    for (const fact of knowledgeBase.facts) {
      expect(fact.roleIds.every((id) => roleIds.has(id))).toBe(true)
      expect(fact.initiativeIds.every((id) => initiativeIds.has(id))).toBe(true)
      expect(fact.skillIds.every((id) => skillIds.has(id))).toBe(true)
      expect(fact.metricIds.every((id) => metricIds.has(id))).toBe(true)
    }
    for (const metric of knowledgeBase.metrics) expect(metric.factIds.every((id) => factIds.has(id))).toBe(true)
  })
})
