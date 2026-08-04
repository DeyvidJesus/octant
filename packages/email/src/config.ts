/**
 * Centralised email configuration.
 *
 * Every knob lives here and every value comes from the environment — no API key, sender address or URL
 * is hardcoded anywhere in the package. The env reader is INJECTED rather than read directly, because
 * this code has to run under three different runtimes: Deno (`Deno.env.get`) in Edge Functions, Node
 * (`process.env`) in scripts, and a plain object in tests.
 *
 * `loadEmailConfig` throws only for values that are present but WRONG (a malformed sender would make
 * every send fail at the provider). Absent optional values fall back to documented defaults and are
 * reported through `warnings`, which the composition root logs — so a missing key degrades to a no-op
 * instead of crashing a webhook, matching how `sentry.ts` and `analytics.ts` behave in this repo.
 */

import { EmailConfigError } from './errors.ts'
import { DEFAULT_RETRY_POLICY, type RetryPolicy } from './transport/retry.ts'

/** Reads one environment variable. Returns `undefined` when unset or empty. */
export type EnvReader = (key: string) => string | undefined

export interface EmailConfig {
  /** RFC 5322 sender, e.g. `Octant <noreply@useoctant.com>`. */
  from: string
  replyTo?: string
  /** Absolute app origin used to build every link. Never has a trailing slash. */
  appUrl: string
  supportEmail: string
  /** Product name shown in subjects, header and footer. */
  appName: string
  /** Absent means "email is not configured here" → the service composes a no-op transport. */
  apiKey?: string
  retry: RetryPolicy
}

export interface LoadedEmailConfig {
  config: EmailConfig
  /** Human-readable notes about defaulted values, for the caller to log once at startup. */
  warnings: string[]
  /** False when `RESEND_API_KEY` is absent — sends will be skipped rather than attempted. */
  isConfigured: boolean
}

const DEFAULTS = {
  appName: 'Octant',
  domain: 'useoctant.com',
  from: 'Octant <noreply@useoctant.com>',
  supportEmail: 'support@useoctant.com',
  /** Vite's dev server origin — only ever used locally, and always warned about. */
  appUrl: 'http://localhost:5173',
} as const

/** `local@domain.tld` or `Display Name <local@domain.tld>`. Deliberately permissive but not empty. */
const SENDER_PATTERN = /^(?:[^<>]*<\s*[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+\s*>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/

/** Bare address, for Reply-To and support. */
const ADDRESS_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

/** Pulls the bare address out of `Display Name <addr>`, or returns the input unchanged. */
export function extractAddress(sender: string): string {
  const match = /<\s*([^\s<>]+)\s*>/.exec(sender)
  return (match?.[1] ?? sender).trim()
}

/** Strips trailing slashes so `${appUrl}/path` never produces a double slash. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '')
}

function readPositiveInt(readEnv: EnvReader, key: string, fallback: number): number {
  const raw = readEnv(key)
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new EmailConfigError(`${key} must be a non-negative number. Got "${raw}".`)
  }
  return parsed
}

/**
 * Builds the config from the environment.
 *
 * Recognised variables:
 *   RESEND_API_KEY      — provider credential. Absent → sends are skipped (no-op transport).
 *   EMAIL_FROM          — sender. Default `Octant <noreply@useoctant.com>`.
 *   EMAIL_REPLY_TO      — optional Reply-To.
 *   EMAIL_SUPPORT       — support address shown in footers.
 *   EMAIL_APP_NAME      — product name. Default `Octant`.
 *   APP_URL             — app origin for links. Shared with the billing functions.
 *   EMAIL_RETRY_ATTEMPTS / EMAIL_RETRY_BASE_DELAY_MS / EMAIL_RETRY_MAX_DELAY_MS — retry overrides,
 *                         so a provider incident can be ridden out by changing a secret, not code.
 */
export function loadEmailConfig(readEnv: EnvReader): LoadedEmailConfig {
  const warnings: string[] = []
  const read = (key: string): string | undefined => {
    const value = readEnv(key)
    return value === undefined || value.trim() === '' ? undefined : value.trim()
  }

  const from = read('EMAIL_FROM') ?? DEFAULTS.from
  if (!SENDER_PATTERN.test(from)) {
    throw new EmailConfigError(
      `EMAIL_FROM must be an email address or "Name <email@domain>". Got "${from}".`,
    )
  }

  const replyTo = read('EMAIL_REPLY_TO')
  if (replyTo !== undefined && !ADDRESS_PATTERN.test(replyTo)) {
    throw new EmailConfigError(`EMAIL_REPLY_TO must be a bare email address. Got "${replyTo}".`)
  }

  const supportEmail = read('EMAIL_SUPPORT') ?? DEFAULTS.supportEmail
  if (!ADDRESS_PATTERN.test(supportEmail)) {
    throw new EmailConfigError(`EMAIL_SUPPORT must be a bare email address. Got "${supportEmail}".`)
  }

  const rawAppUrl = read('APP_URL')
  if (rawAppUrl === undefined) {
    warnings.push(
      `APP_URL is not set — links will point at ${DEFAULTS.appUrl}. Set it before sending real email.`,
    )
  }
  const appUrl = normalizeOrigin(rawAppUrl ?? DEFAULTS.appUrl)

  const apiKey = read('RESEND_API_KEY')
  if (apiKey === undefined) {
    warnings.push('RESEND_API_KEY is not set — email sending is disabled and every send is a no-op.')
  }

  const retry: RetryPolicy = {
    attempts: readPositiveInt(readEnv, 'EMAIL_RETRY_ATTEMPTS', DEFAULT_RETRY_POLICY.attempts),
    baseDelayMs: readPositiveInt(readEnv, 'EMAIL_RETRY_BASE_DELAY_MS', DEFAULT_RETRY_POLICY.baseDelayMs),
    maxDelayMs: readPositiveInt(readEnv, 'EMAIL_RETRY_MAX_DELAY_MS', DEFAULT_RETRY_POLICY.maxDelayMs),
  }

  return {
    config: {
      from,
      replyTo,
      appUrl,
      supportEmail,
      appName: read('EMAIL_APP_NAME') ?? DEFAULTS.appName,
      apiKey,
      retry,
    },
    warnings,
    isConfigured: apiKey !== undefined,
  }
}

export { DEFAULTS as EMAIL_CONFIG_DEFAULTS }
