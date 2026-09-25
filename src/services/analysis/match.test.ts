import { describe, it, expect } from 'vitest'
import { buildMatchReport, collectResumeSkills } from './match'
import { extractSkills } from './extract'
import { createSeedResume } from '@/test/fixtures/sampleCareer'

const resume = createSeedResume()
const resumeSkills = collectResumeSkills(resume)

describe('collectResumeSkills', () => {
  it('collects explicit skills and project tech from the seed resume', () => {
    expect(resumeSkills.has('React')).toBe(true)
    expect(resumeSkills.has('TypeScript')).toBe(true)
    expect(resumeSkills.has('PostgreSQL')).toBe(true)
  })

  it('does not pick up skills the resume never mentions', () => {
    expect(resumeSkills.has('Rust')).toBe(false)
    expect(resumeSkills.has('Kubernetes')).toBe(false)
  })
})

describe('buildMatchReport', () => {
  const jdHits = extractSkills(
    'Senior React and TypeScript role. Node.js and PostgreSQL required. Rust and Kubernetes are a plus.',
  )
  const report = buildMatchReport(jdHits, resumeSkills)

  it('matched is a strict subset of the resume skills (never invents experience)', () => {
    for (const skill of report.matched) {
      expect(resumeSkills.has(skill)).toBe(true)
    }
  })

  it('lists resume-absent skills only under missing', () => {
    expect(report.missing).toContain('Rust')
    expect(report.missing).toContain('Kubernetes')
    expect(report.matched).not.toContain('Rust')
  })

  it('produces an ATS score between 0 and 100', () => {
    expect(report.atsScore).toBeGreaterThanOrEqual(0)
    expect(report.atsScore).toBeLessThanOrEqual(100)
  })

  it('weights required coverage above nice-to-haves', () => {
    // Required-skill overlap should outscore the same overlap on "nice to have" skills.
    const requiredJd = extractSkills('Requirements: React, TypeScript, Node.js.')
    const preferredJd = extractSkills('Nice to have: React, TypeScript, Node.js.')
    const requiredScore = buildMatchReport(requiredJd, resumeSkills).atsScore
    const preferredScore = buildMatchReport(preferredJd, resumeSkills).atsScore
    expect(requiredScore).toBeGreaterThanOrEqual(preferredScore)
  })

  it('pins the ATS formula: required skills weigh count × 2, nice-to-haves count × 1', () => {
    // React required twice (weight 4), GraphQL nice-to-have once (weight 1); the resume only has React.
    const jd = extractSkills('Requirements: React. You will ship React features daily.\nNice to have: GraphQL.')
    expect(jd.map((hit) => [hit.entry.canonical, hit.importance, hit.count])).toEqual([
      ['React', 'required', 2],
      ['GraphQL', 'preferred', 1],
    ])
    expect(buildMatchReport(jd, new Set(['React'])).atsScore).toBe(80)
  })

  it('returns 0 for a JD with no recognized skills', () => {
    expect(buildMatchReport([], resumeSkills).atsScore).toBe(0)
  })
})
