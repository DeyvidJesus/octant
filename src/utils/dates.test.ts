import { describe, expect, it } from 'vitest'
import { formatRelative, fromDateInput, isDue, isOverdue, toDateInput } from './dates'

const REF = new Date('2026-07-16T12:00:00.000Z')

describe('date input conversion', () => {
  it('round-trips ISO ↔ YYYY-MM-DD', () => {
    expect(toDateInput('2026-07-16T12:00:00.000Z')).toBe('2026-07-16')
    expect(fromDateInput('2026-07-16')).toBe('2026-07-16T00:00:00.000Z')
  })

  it('handles empty / invalid input', () => {
    expect(toDateInput(undefined)).toBe('')
    expect(toDateInput('not-a-date')).toBe('')
    expect(fromDateInput('')).toBeUndefined()
  })
})

describe('formatRelative', () => {
  it('labels today, future, and past days', () => {
    expect(formatRelative('2026-07-16T20:00:00.000Z', REF)).toBe('today')
    expect(formatRelative('2026-07-19T00:00:00.000Z', REF)).toBe('in 3d')
    expect(formatRelative('2026-07-14T00:00:00.000Z', REF)).toBe('2d ago')
  })
})

describe('isOverdue / isDue', () => {
  it('isOverdue is true only strictly before today', () => {
    expect(isOverdue('2026-07-15T00:00:00.000Z', REF)).toBe(true)
    expect(isOverdue('2026-07-16T00:00:00.000Z', REF)).toBe(false)
    expect(isOverdue('2026-07-17T00:00:00.000Z', REF)).toBe(false)
    expect(isOverdue(undefined, REF)).toBe(false)
  })

  it('isDue includes today', () => {
    expect(isDue('2026-07-16T00:00:00.000Z', REF)).toBe(true)
    expect(isDue('2026-07-15T00:00:00.000Z', REF)).toBe(true)
    expect(isDue('2026-07-17T00:00:00.000Z', REF)).toBe(false)
    expect(isDue(undefined, REF)).toBe(false)
  })
})
