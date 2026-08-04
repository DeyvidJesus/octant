import { describe, expect, it } from 'vitest'
import { daysBetween, formatDate, formatDateTime, formatMoney, fromMinorUnits } from './formatting.ts'

/** 4 Aug 2026, 00:00 UTC. */
const NOW = 1_785_801_600
const DAY = 86_400

describe('fromMinorUnits', () => {
  it('divides by 100 for ordinary currencies', () => {
    expect(fromMinorUnits(4900, 'brl')).toBe(49)
    expect(fromMinorUnits(4900, 'USD')).toBe(49)
  })

  it('leaves zero-decimal currencies alone — dividing would under-report by 100x', () => {
    expect(fromMinorUnits(4900, 'jpy')).toBe(4900)
    expect(fromMinorUnits(4900, 'KRW')).toBe(4900)
  })

  it('divides by 1000 for three-decimal currencies', () => {
    expect(fromMinorUnits(4900, 'kwd')).toBe(4.9)
  })
})

describe('formatMoney', () => {
  it('formats an ordinary currency', () => {
    expect(formatMoney(4900, 'brl', { locale: 'en-US' })).toBe('R$49.00')
  })

  it('formats a zero-decimal currency without inventing cents', () => {
    expect(formatMoney(4900, 'jpy', { locale: 'en-US' })).toBe('¥4,900')
  })

  it('returns undefined for a missing amount, so callers can omit the row entirely', () => {
    expect(formatMoney(null, 'brl')).toBeUndefined()
    expect(formatMoney(undefined, 'brl')).toBeUndefined()
    expect(formatMoney(Number.NaN, 'brl')).toBeUndefined()
  })

  it('formats zero rather than treating it as missing', () => {
    expect(formatMoney(0, 'usd', { locale: 'en-US' })).toBe('$0.00')
  })

  it('renders an unknown-but-well-formed code using the code itself', () => {
    // Intl accepts any three-letter code, so this needs no fallback.
    expect(formatMoney(4900, 'zzz', { locale: 'en-US' })).toBe('ZZZ 49.00')
  })

  it('normalises the non-breaking space Intl inserts after a currency code', () => {
    const formatted = formatMoney(4900, 'zzz', { locale: 'en-US' })
    expect(formatted).not.toContain(' ')
  })

  it('degrades instead of throwing on a malformed currency code', () => {
    // A one-letter code makes Intl throw a RangeError; the fallback keeps one bad value from taking
    // down a whole webhook for the sake of a formatted string.
    expect(formatMoney(4900, 'x', { locale: 'en-US' })).toBe('49 X')
  })

  it('treats an empty currency as USD rather than emitting a currency-less amount', () => {
    expect(formatMoney(4900, '', { locale: 'en-US' })).toBe('$49.00')
    expect(formatMoney(4900, '  ', { locale: 'en-US' })).toBe('$49.00')
  })

  it('defaults to USD when the provider omits a currency', () => {
    expect(formatMoney(4900, null, { locale: 'en-US' })).toBe('$49.00')
  })
})

describe('formatDate', () => {
  it('formats a Unix-seconds timestamp readably', () => {
    expect(formatDate(NOW, { locale: 'en-US', timeZone: 'UTC' })).toBe('Aug 4, 2026')
  })

  it('returns undefined for a missing timestamp', () => {
    expect(formatDate(null)).toBeUndefined()
    expect(formatDate(undefined)).toBeUndefined()
  })
})

describe('formatDateTime', () => {
  it('formats an ISO string with an explicit zone label', () => {
    expect(formatDateTime('2026-08-04T14:32:00Z', { locale: 'en-US', timeZone: 'UTC' })).toContain('UTC')
    expect(formatDateTime('2026-08-04T14:32:00Z', { locale: 'en-US', timeZone: 'UTC' })).toContain('14:32')
  })

  it('returns undefined rather than "Invalid Date" for unparseable input', () => {
    expect(formatDateTime('not a date')).toBeUndefined()
    expect(formatDateTime('')).toBeUndefined()
    expect(formatDateTime(null)).toBeUndefined()
  })
})

describe('daysBetween', () => {
  it('rounds a partial day up, so "ends in 3 days" never reads as 2', () => {
    expect(daysBetween(NOW, NOW + 3 * DAY)).toBe(3)
    expect(daysBetween(NOW, NOW + 3 * DAY - 60)).toBe(3)
  })

  it('floors at zero for a window that has already passed', () => {
    expect(daysBetween(NOW, NOW - DAY)).toBe(0)
    expect(daysBetween(NOW, NOW)).toBe(0)
  })
})
