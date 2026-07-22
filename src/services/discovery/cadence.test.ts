import { describe, it, expect } from 'vitest'
import { isDueForRun, DISCOVERY_CADENCE_HOURS } from './cadence'

const now = Date.parse('2026-07-22T12:00:00Z')
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString()

describe('isDueForRun', () => {
  it('is due when never run', () => {
    expect(isDueForRun(null, 'free', now)).toBe(true)
    expect(isDueForRun(null, 'pro', now)).toBe(true)
  })

  it('free tier is due after 24h, not before', () => {
    expect(isDueForRun(hoursAgo(23), 'free', now)).toBe(false)
    expect(isDueForRun(hoursAgo(25), 'free', now)).toBe(true)
  })

  it('pro tier is due after 1h, not before', () => {
    expect(isDueForRun(hoursAgo(0.5), 'pro', now)).toBe(false)
    expect(isDueForRun(hoursAgo(2), 'pro', now)).toBe(true)
  })

  it('treats an unparseable timestamp as due (fail-open)', () => {
    expect(isDueForRun('not-a-date', 'pro', now)).toBe(true)
  })

  it('exposes the cadence table', () => {
    expect(DISCOVERY_CADENCE_HOURS.free).toBe(24)
    expect(DISCOVERY_CADENCE_HOURS.pro).toBe(1)
  })
})
