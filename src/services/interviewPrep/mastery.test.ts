import { describe, expect, it } from 'vitest'
import { blendMastery, clampScore, skillKeyFor } from './mastery'

describe('blendMastery', () => {
  it('takes the first score directly', () => {
    expect(blendMastery(null, 70)).toEqual({ mastery: 70, attempts: 1 })
  })

  it('runs a plain average across attempts', () => {
    const first = blendMastery(null, 60) // {60, 1}
    const second = blendMastery(first, 80) // (60+80)/2 = 70
    expect(second).toEqual({ mastery: 70, attempts: 2 })
    const third = blendMastery(second, 90) // (70*2 + 90)/3 = 76.67 -> 77
    expect(third).toEqual({ mastery: 77, attempts: 3 })
  })

  it('clamps and rounds out-of-range / non-finite scores', () => {
    expect(blendMastery(null, 150)).toEqual({ mastery: 100, attempts: 1 })
    expect(blendMastery(null, -5)).toEqual({ mastery: 0, attempts: 1 })
    expect(clampScore(Number.NaN)).toBe(0)
    expect(clampScore(83.6)).toBe(84)
  })
})

describe('skillKeyFor', () => {
  it('prefers a topic', () => {
    expect(skillKeyFor('React', 'technical')).toBe('React')
  })
  it('falls back to category when topic is empty/undefined', () => {
    expect(skillKeyFor(undefined, 'behavioral')).toBe('behavioral')
    expect(skillKeyFor('  ', 'architecture')).toBe('architecture')
  })
})
