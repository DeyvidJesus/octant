import { describe, it, expect } from 'vitest'
import { migrateResumeState } from './resumeMigrations'

const v1State = {
  resume: {
    personal: { name: 'Deyvid', role: 'Engineer', location: 'Brazil', english: 'C1' },
    summary: 'Summary text',
    goals: 'Goals text',
    values: ['clean code'],
    experience: [
      { id: 'e1', company: 'Econverse', role: 'SWE', duration: '2024-Present', bullets: ['Built React apps', 'Improved SEO'] },
    ],
    projects: [{ id: 'p1', name: 'GoMech', tech: ['Java'], description: 'SaaS', bullets: ['Multi-tenant backend'] }],
    skills: [{ label: 'Frontend', skills: ['React', 'TypeScript'] }],
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
}

describe('migrateResumeState v1 -> v2', () => {
  const migrated = migrateResumeState(v1State, 1).resume

  it('converts string bullets into structured accomplishments', () => {
    expect(migrated.experience[0].accomplishments).toHaveLength(2)
    expect(migrated.experience[0].accomplishments[0].text).toBe('Built React apps')
    expect(migrated.experience[0].accomplishments[0].skills).toEqual([])
    expect(migrated.projects[0].accomplishments[0].text).toBe('Multi-tenant backend')
  })

  it('flattens grouped skills into skill entities carrying their category', () => {
    const react = migrated.skills.find((s) => s.canonical === 'React')
    expect(react?.category).toBe('Frontend')
    expect(migrated.skills.map((s) => s.canonical)).toEqual(['React', 'TypeScript'])
  })

  it('moves personal.english into languages', () => {
    expect(migrated.languages.some((l) => l.name === 'English' && l.level === 'C1')).toBe(true)
  })

  it('adds the new empty collections', () => {
    expect(migrated.stories).toEqual([])
    expect(migrated.certifications).toEqual([])
    expect(migrated.portfolio).toEqual([])
  })

  it('preserves scalar fields', () => {
    expect(migrated.summary).toBe('Summary text')
    expect(migrated.goals).toBe('Goals text')
    expect(migrated.values).toEqual(['clean code'])
  })

  it('falls back to seed data when there is no persisted resume', () => {
    const result = migrateResumeState({}, 1)
    expect(result.resume.personal.name).toBeTruthy()
    expect(result.resume.skills.length).toBeGreaterThan(0)
  })

  it('passes through already-migrated (v2) state untouched', () => {
    const v2 = { resume: { marker: true } }
    expect(migrateResumeState(v2, 2)).toBe(v2)
  })
})
