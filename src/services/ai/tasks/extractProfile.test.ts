import { describe, it, expect } from 'vitest'
import { parseResumeJson, buildKnowledgeBaseFromExtraction } from './extractProfile'

describe('parseResumeJson', () => {
  it('extracts a JSON object from prose/fence-wrapped output', () => {
    const text = 'Here you go:\n```json\n{"profile":{"name":"Ada"},"skills":[],"experiences":[],"education":[]}\n```'
    expect(parseResumeJson(text)).toMatchObject({ profile: { name: 'Ada' } })
  })

  it('throws when no object is present', () => {
    expect(() => parseResumeJson('no json here')).toThrow()
  })
})

describe('buildKnowledgeBaseFromExtraction', () => {
  const raw = {
    profile: { name: 'Ada Lovelace', role: 'Engineer', location: 'London', email: 'ada@x.io', summary: 'Builds things', careerDirection: 'Staff' },
    skills: [
      { name: 'TypeScript', category: 'Frontend' },
      { name: 'typescript', category: 'Frontend' }, // duplicate (case-insensitive) — dropped
      { name: 'PostgreSQL' }, // no category → General
    ],
    experiences: [
      { company: 'Acme', title: 'Senior Engineer', period: '2020-2024', location: 'Remote', bullets: ['Led the platform team', 'Shipped billing'] },
      { company: 'Acme', title: 'Engineer', period: '2018-2020', bullets: ['Built the API'] }, // same org → reused
    ],
    education: [{ institution: 'MIT', degree: 'BSc', field: 'CS', start: '2014', end: '2018' }],
  }

  it('assembles a valid, review-gated knowledge base with our ids and provenance', () => {
    const { knowledgeBase: kb, counts } = buildKnowledgeBaseFromExtraction(raw)

    expect(kb.profile.personal).toMatchObject({ name: 'Ada Lovelace', role: 'Engineer', email: 'ada@x.io' })
    expect(kb.profile.summary).toBe('Builds things')

    // Skills deduped case-insensitively; missing category defaults to General.
    expect(counts.skills).toBe(2)
    expect(kb.skills.find((s) => s.canonical === 'PostgreSQL')?.category).toBe('General')

    // Two roles across ONE organization (Acme reused).
    expect(kb.organizations).toHaveLength(1)
    expect(counts.roles).toBe(2)

    // Every bullet becomes a needs_review fact linked to its role, provenance back to the résumé.
    expect(counts.facts).toBe(3)
    expect(kb.facts.every((f) => f.status === 'needs_review')).toBe(true)
    expect(kb.facts.every((f) => f.roleIds.length === 1)).toBe(true)
    expect(kb.facts[0].provenance.source).toMatch(/résumé import/i)

    // Education → credential.
    expect(counts.credentials).toBe(1)
    expect(kb.credentials[0]).toMatchObject({ type: 'education', name: 'BSc', issuer: 'MIT' })
  })

  it('never invents data from an empty/garbage payload', () => {
    const { knowledgeBase: kb, counts } = buildKnowledgeBaseFromExtraction({})
    expect(counts).toEqual({ skills: 0, roles: 0, facts: 0, credentials: 0 })
    expect(kb.profile.personal.name).toBe('')
    expect(kb.schemaVersion).toBe(3)
  })

  it('tolerates non-object input', () => {
    expect(() => buildKnowledgeBaseFromExtraction(null)).not.toThrow()
    expect(() => buildKnowledgeBaseFromExtraction('nope')).not.toThrow()
  })
})
