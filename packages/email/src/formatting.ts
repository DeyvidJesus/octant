// Money and date formatting for email props, shared by every caller so output is identical.

/** Stripe zero-decimal currencies: amounts are already whole, so dividing by 100 would under-report. */
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

/** Formats a minor-unit amount; `undefined` when missing so callers omit the row instead of showing zero. */
export function formatMoney(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
  options?: FormattingOptions,
): string | undefined {
  if (amountMinor === null || amountMinor === undefined || !Number.isFinite(amountMinor)) return undefined
  // An empty string is not nullish, so `??` alone would not catch it.
  const trimmed = (currency ?? '').trim()
  const code = (trimmed === '' ? 'USD' : trimmed).toUpperCase()
  try {
    const formatted = new Intl.NumberFormat(options?.locale ?? 'en-US', {
      style: 'currency',
      currency: code,
    }).format(fromMinorUnits(amountMinor, code))
    // Intl sometimes inserts U+00A0; a plain space keeps tests and the text part predictable.
    return formatted.replace(/ /g, ' ')
  } catch {
    // An invalid currency code must not throw and take the webhook down.
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
