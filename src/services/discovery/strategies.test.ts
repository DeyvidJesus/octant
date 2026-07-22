import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@/types/searchProfile'
import { parseStrategies, generateStrategiesWithAi, buildStrategyGenPrompt } from './strategies'

const profile: SearchProfile = {
  ...DEFAULT_SEARCH_PROFILE,
  targetRoles: ['Backend Engineer'],
  technologies: ['Go', 'Postgres'],
  excludeKeywords: ['crypto'],
}

describe('buildStrategyGenPrompt', () => {
  it('serialises only the populated profile fields', () => {
    const prompt = buildStrategyGenPrompt(profile)
    expect(prompt).toContain('Backend Engineer')
    expect(prompt).toContain('Go, Postgres')
    expect(prompt).toContain('Exclude: crypto')
    expect(prompt).not.toContain('Minimum salary')
  })
})

describe('parseStrategies', () => {
  it('parses a fenced JSON array, dropping entries without a query and capping the count', () => {
    const text = '```json\n[{"label":"A","query":"senior go remote","rationale":"fits"},{"label":"no query"},{"query":"postgres backend"}]\n```'
    const strategies = parseStrategies(text)
    expect(strategies).toHaveLength(2)
    expect(strategies[0]).toMatchObject({ label: 'A', query: 'senior go remote' })
    expect(strategies[1].label).toBe('postgres backend') // label defaults to the query
    expect(strategies[0].id).toMatch(/^strategy-ai-/)
  })

  it('throws when there is no array', () => {
    expect(() => parseStrategies('nope')).toThrow()
  })
})

describe('generateStrategiesWithAi', () => {
  it('returns AI strategies when the completion is valid JSON', async () => {
    const complete = vi.fn().mockResolvedValue('[{"label":"X","query":"go backend remote"}]')
    const strategies = await generateStrategiesWithAi(profile, complete)
    expect(strategies).toHaveLength(1)
    expect(strategies[0].query).toBe('go backend remote')
  })

  it('falls back to the deterministic builder when the AI call throws', async () => {
    const complete = vi.fn().mockRejectedValue(new Error('boom'))
    const strategies = await generateStrategiesWithAi(profile, complete)
    // deterministic fallback derives from targetRoles
    expect(strategies.length).toBeGreaterThanOrEqual(1)
    expect(strategies[0].label).toBe('Backend Engineer')
  })

  it('falls back when the AI returns an empty array', async () => {
    const complete = vi.fn().mockResolvedValue('[]')
    const strategies = await generateStrategiesWithAi(profile, complete)
    expect(strategies.length).toBeGreaterThanOrEqual(1)
    expect(strategies[0].label).toBe('Backend Engineer')
  })
})
