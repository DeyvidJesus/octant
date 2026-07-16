import { describe, expect, it } from 'vitest'
import {
  applyRate,
  applyRemove,
  applyStatus,
  applyToggleMastered,
  clampConfidence,
} from './progress'
import type { PrepQuestion } from '@/types/interviewPrep'

const question: PrepQuestion = {
  id: 'react-advanced',
  category: 'technical',
  difficulty: 'advanced',
  question: 'How do you reason about React re-renders at scale?',
  topic: 'React',
  priority: 'required-matched',
}

const now = '2026-01-01T00:00:00.000Z'

describe('interview prep progress reducers', () => {
  it('upserts a tracked question when rating confidence', () => {
    const entry = applyRate({}, question, 75, now)[question.id]

    expect(entry.confidence).toBe(75)
    expect(entry.status).toBe('in_progress')
    expect(entry.category).toBe('technical')
    expect(entry.lastReviewedAt).toBe(now)
  })

  it('clamps confidence to the 0-100 range', () => {
    expect(clampConfidence(250)).toBe(100)
    expect(clampConfidence(-10)).toBe(0)
    expect(clampConfidence(Number.NaN)).toBe(0)
    expect(applyRate({}, question, 250, now)[question.id].confidence).toBe(100)
  })

  it('toggles mastered on and off with sensible status/confidence', () => {
    const on = applyToggleMastered({}, question, now)
    expect(on[question.id].mastered).toBe(true)
    expect(on[question.id].status).toBe('mastered')
    expect(on[question.id].confidence).toBe(100)

    const off = applyToggleMastered(on, question, now)
    expect(off[question.id].mastered).toBe(false)
    expect(off[question.id].status).toBe('in_progress')
  })

  it('sets review status and removes tracked entries', () => {
    const flagged = applyStatus({}, question, 'need_review', now)
    expect(flagged[question.id].status).toBe('need_review')

    const removed = applyRemove(flagged, question.id)
    expect(removed[question.id]).toBeUndefined()
  })

  it('does not mutate the input map', () => {
    const initial = {}
    applyRate(initial, question, 50, now)
    expect(initial).toEqual({})
  })
})
