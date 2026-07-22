import { describe, it, expect } from 'vitest'
import type { JobAnalysis } from '@/types/analysis'
import type { DiscoveredCandidate } from '@/types/discovery'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@/types/searchProfile'
import { learnPreferences, applyLearnedToProfile, rankScore, buildSignalFeatures, type DiscoverySignal } from './signals'

function candidate(company: string, techs: string[], score?: number): DiscoveredCandidate {
  const analysis: JobAnalysis = {
    jobId: 'j', analyzerId: 't', analyzedAt: '', detectedStack: techs.map((c) => ({ term: c, canonical: c, category: 'x', count: 1, inResume: true, importance: 'required' as const })),
    detectedSeniority: 'senior', seniorityEvidence: [], atsKeywords: [], match: { atsScore: score ?? 0, matched: techs, missing: [], categoryBreakdown: [], notes: [] },
  }
  return { id: company, company, role: 'Engineer', description: 'x', workMode: 'remote', origin: 'agent', sourceNote: '', foundAt: '', matchScore: score, analysis }
}

describe('learnPreferences', () => {
  it('nets technology weights across actions and flags repeatedly-dismissed companies', () => {
    const signals: DiscoverySignal[] = [
      { action: 'applied', features: buildSignalFeatures(candidate('Acme', ['React', 'Go'], 80)) }, // +2 each
      { action: 'approved', features: buildSignalFeatures(candidate('Beta', ['React'], 70)) }, // +1
      { action: 'dismissed', features: buildSignalFeatures(candidate('Crypto Inc', ['Solidity'], 40)) }, // -1
      { action: 'dismissed', features: buildSignalFeatures(candidate('Crypto Inc', ['Solidity'], 30)) }, // -1 → net -2
    ]
    const prefs = learnPreferences(signals)
    expect(prefs.technologyScores.React).toBe(3)
    expect(prefs.technologyScores.Go).toBe(2)
    expect(prefs.technologyScores.Solidity).toBe(-2)
    expect(prefs.dislikedCompanies).toContain('Crypto Inc')
  })
})

describe('applyLearnedToProfile', () => {
  const prefs = learnPreferences([
    { action: 'applied', features: buildSignalFeatures(candidate('Acme', ['Rust'], 80)) },
    { action: 'dismissed', features: buildSignalFeatures(candidate('Bad Co', ['PHP'], 20)) },
    { action: 'dismissed', features: buildSignalFeatures(candidate('Bad Co', ['PHP'], 20)) },
  ])

  it('folds preferred technologies in and excludes disliked companies', () => {
    const profile: SearchProfile = { ...DEFAULT_SEARCH_PROFILE, technologies: ['Go'] }
    const augmented = applyLearnedToProfile(profile, prefs)
    expect(augmented.technologies).toContain('Rust')
    expect(augmented.technologies).toContain('Go')
    expect(augmented.excludeKeywords).toContain('Bad Co')
  })

  it('is a no-op when nothing was learned', () => {
    const profile: SearchProfile = { ...DEFAULT_SEARCH_PROFILE, technologies: ['Go'] }
    expect(applyLearnedToProfile(profile, learnPreferences([]))).toBe(profile)
  })
})

describe('rankScore', () => {
  const prefs = learnPreferences([
    { action: 'applied', features: buildSignalFeatures(candidate('Acme', ['React'], 80)) },
    { action: 'dismissed', features: buildSignalFeatures(candidate('Bad Co', ['PHP'], 20)) },
    { action: 'dismissed', features: buildSignalFeatures(candidate('Bad Co', ['PHP'], 20)) },
  ])

  it('nudges a preferred-tech candidate up and a disliked company down', () => {
    expect(rankScore(candidate('Neutral', ['React'], 60), prefs)).toBeGreaterThan(60)
    expect(rankScore(candidate('Bad Co', ['PHP'], 60), prefs)).toBeLessThan(60)
  })

  it('keeps unscored candidates at the bottom', () => {
    expect(rankScore(candidate('X', ['React'], undefined), prefs)).toBe(-1)
  })
})
