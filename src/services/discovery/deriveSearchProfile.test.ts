import { describe, it, expect } from 'vitest'
import { createEmptyKnowledgeBase } from '@/constants/seedData'
import type { CareerKnowledgeBase, KnowledgeSkill } from '@/types/resume'
import type { DiscoveryPrefs } from '@/types/discovery'
import { deriveSearchProfile, resolveSearchProfile } from './deriveSearchProfile'

function skill(canonical: string, proficiency: 1 | 2 | 3 | 4 | 5, favorite = false): KnowledgeSkill {
  return { id: `skill-${canonical}`, canonical, category: 'x', proficiency, favorite, evidenceFactIds: [], provenance: { source: 't', excerpt: canonical } }
}

function kbWith(overrides: Partial<CareerKnowledgeBase['profile']>, skills: KnowledgeSkill[] = []): CareerKnowledgeBase {
  const kb = createEmptyKnowledgeBase()
  kb.profile = { ...kb.profile, ...overrides }
  kb.skills = skills
  return kb
}

describe('deriveSearchProfile', () => {
  it('seeds roles, seniority, technologies, languages and work modes from the resume', () => {
    const kb = kbWith(
      {
        personal: { name: 'Ada', role: 'Senior Full Stack Engineer', location: 'Remote (LATAM)' },
        careerDirection: 'Seeking international remote roles at product companies',
        languages: [{ id: 'l1', name: 'English', level: 'C1' }, { id: 'l2', name: 'Portuguese', level: 'Native' }],
      },
      [skill('TypeScript', 3), skill('React', 5, true), skill('Go', 4)],
    )
    const p = deriveSearchProfile(kb)

    expect(p.targetRoles).toEqual(['Senior Full Stack Engineer'])
    expect(p.seniority).toBe('senior')
    // favourite first, then by proficiency desc
    expect(p.technologies[0]).toBe('React')
    expect(p.technologies).toContain('Go')
    expect(p.languages).toEqual(['English', 'Portuguese'])
    expect(p.workModes).toContain('remote')
    expect(p.locations).toEqual(['Remote (LATAM)'])
  })

  it('migrates legacy free-text DiscoveryPrefs (comma-split), preferring them over resume', () => {
    const kb = kbWith({ personal: { name: '', role: 'Engineer', location: 'NYC' } })
    const legacy: DiscoveryPrefs = {
      targetRoles: 'Staff Engineer, Principal Engineer',
      regions: 'Remote — US, Europe',
      seniority: 'staff',
      extraInstructions: 'Avoid crypto.',
    }
    const p = deriveSearchProfile(kb, legacy)
    expect(p.targetRoles).toEqual(['Staff Engineer', 'Principal Engineer'])
    expect(p.seniority).toBe('staff')
    expect(p.locations).toEqual(['Remote — US', 'Europe'])
    expect(p.extraInstructions).toBe('Avoid crypto.')
  })
})

describe('resolveSearchProfile', () => {
  const kb = kbWith({ personal: { name: '', role: 'Mid Backend Engineer', location: 'Berlin' } }, [skill('Java', 4)])

  it('falls back to derived values for empty stored fields', () => {
    const resolved = resolveSearchProfile(
      { targetRoles: [], seniority: 'unknown', technologies: [], locations: [], workModes: [], languages: [], includeKeywords: [], excludeKeywords: [], extraInstructions: '' },
      kb,
    )
    expect(resolved.targetRoles).toEqual(['Mid Backend Engineer'])
    expect(resolved.seniority).toBe('mid')
    expect(resolved.technologies).toContain('Java')
  })

  it('lets non-empty stored values win over derived', () => {
    const resolved = resolveSearchProfile(
      { targetRoles: ['SRE'], seniority: 'senior', technologies: ['Kubernetes'], locations: ['Remote'], workModes: ['remote'], languages: ['English'], salaryFloor: 120000, salaryCurrency: 'USD', includeKeywords: [], excludeKeywords: ['agency'], extraInstructions: 'Product-only.' },
      kb,
    )
    expect(resolved.targetRoles).toEqual(['SRE'])
    expect(resolved.seniority).toBe('senior')
    expect(resolved.technologies).toEqual(['Kubernetes'])
    expect(resolved.salaryFloor).toBe(120000)
    expect(resolved.excludeKeywords).toEqual(['agency'])
  })
})
