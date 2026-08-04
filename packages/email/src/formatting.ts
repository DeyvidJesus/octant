/**
 * Money and date formatting for email props.
 *
 * Templates take pre-formatted strings, so this is where the formatting happens — once, for every caller.
 * Kept here rather than in an Edge Function because it's pure and therefore testable, and because the
 * billing webhook and any future digest job must format identically.
 *
 * `Intl` is available in Node, Deno and browsers, so there's no dependency to add.
 */

/**
 * Currencies with no minor unit. Stripe reports amounts in the smallest unit, which for these means the
 * amount is already whole — dividing by 100 would silently under-report the charge by 100×.
 *
 * @see https://docs.stripe.com/currencies#zero-decimal
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf',
  'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
])

/** Currencies whose smallest unit is 1/1000. */
const THREE_DECIMAL_CURRENCIES = new Set(['bhd', 'jod', 'kwd', 'omr', 'tnd'])

export interface FormattingOptions {
  /** BCP 47 tag. Defaults to `en-US`, matching the templates' copy. */
  locale?: string
  /** IANA time zone for dates. Defaults to UTC so the rendered value is unambiguous. */
  timeZone?: string
}

/** Converts a Stripe minor-unit amount to its major-unit decimal value. */
export function fromMinorUnits(amountMinor: number, currency: string): number {
  const code = currency.toLowerCase()
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return amountMinor
  if (THREE_DECIMAL_CURRENCIES.has(code)) return amountMinor / 1_000
  return amountMinor / 100
}

/**
 * Formats a provider amount for display, e.g. `R$ 49.00` / `¥ 4900`.
 * Returns `undefined` for a missing amount, so callers can leave the row out entirely rather than
 * printing a zero that reads like "you owe nothing".
 */
export function formatMoney(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  options?: FormattingOptions,
): string | undefined {
  if (amountMinor === null || amountMinor === undefined || !Number.isFinite(amountMinor)) return undefined
  // `?? 'usd'` alone would miss an empty string, which is not nullish and yields a currency-less "49 ".
  const trimmed = (currency ?? '').trim()
  const code = (trimmed === '' ? 'USD' : trimmed).toUpperCase()
  try {
    const formatted = new Intl.NumberFormat(options?.locale ?? 'en-US', {
      style: 'currency',
      currency: code,
    }).format(fromMinorUnits(amountMinor, code))
    // Intl separates some currency codes from the amount with U+00A0. Normalising to a plain space keeps
    // the value predictable for tests and avoids a stray non-breaking space in the plain-text part.
    return formatted.replace(/ /g, ' ')
  } catch {
    // An unknown/invalid currency code would otherwise throw and take the whole webhook down for the
    // sake of one formatted string.
    return `${fromMinorUnits(amountMinor, code)} ${code}`
  }
}

/** Formats a Unix-seconds timestamp as a readable date, e.g. `3 Sep 2026`. */
export function formatDate(
  unixSeconds: number | null | undefined,
  options?: FormattingOptions,
): string | undefined {
  if (unixSeconds === null || unixSeconds === undefined || !Number.isFinite(unixSeconds)) return undefined
  return new Intl.DateTimeFormat(options?.locale ?? 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: options?.timeZone ?? 'UTC',
  }).format(new Date(unixSeconds * 1_000))
}

/** Formats an ISO timestamp as a date and time, e.g. `4 Aug 2026, 14:32 UTC`. */
export function formatDateTime(iso: string | null | undefined, options?: FormattingOptions): string | undefined {
  if (iso === null || iso === undefined || iso === '') return undefined
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return undefined
  const timeZone = options?.timeZone ?? 'UTC'
  const formatted = new Intl.DateTimeFormat(options?.locale ?? 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(parsed)
  return `${formatted} ${timeZone === 'UTC' ? 'UTC' : timeZone}`
}

/** Whole days between two Unix-seconds timestamps, floored at 0. */
export function daysBetween(fromUnixSeconds: number, toUnixSeconds: number): number {
  const seconds = toUnixSeconds - fromUnixSeconds
  return Math.max(0, Math.ceil(seconds / 86_400))
}
