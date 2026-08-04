import { describe, expect, it } from 'vitest'
import { EmailConfigError } from './errors.ts'
import { extractAddress, loadEmailConfig, type EnvReader } from './config.ts'

/** Builds an env reader over a plain object — the third runtime this code has to support. */
function env(values: Record<string, string | undefined>): EnvReader {
  return (key) => values[key]
}

describe('loadEmailConfig', () => {
  it('applies documented defaults when nothing is set', () => {
    const { config, isConfigured, warnings } = loadEmailConfig(env({}))

    expect(config.from).toBe('Octant <noreply@useoctant.com>')
    expect(config.appName).toBe('Octant')
    expect(config.supportEmail).toBe('support@useoctant.com')
    expect(config.apiKey).toBeUndefined()
    expect(isConfigured).toBe(false)
    // Both defaults are surfaced rather than applied silently.
    expect(warnings).toHaveLength(2)
    expect(warnings.join(' ')).toContain('RESEND_API_KEY')
    expect(warnings.join(' ')).toContain('APP_URL')
  })

  it('reports configured when an API key is present', () => {
    const { isConfigured, config, warnings } = loadEmailConfig(
      env({ RESEND_API_KEY: 're_test', APP_URL: 'https://app.useoctant.com' }),
    )

    expect(isConfigured).toBe(true)
    expect(config.apiKey).toBe('re_test')
    expect(warnings).toEqual([])
  })

  it('strips trailing slashes from APP_URL so link building never doubles them', () => {
    const { config } = loadEmailConfig(env({ APP_URL: 'https://app.useoctant.com///' }))
    expect(config.appUrl).toBe('https://app.useoctant.com')
  })

  it('treats whitespace-only values as unset', () => {
    const { config, isConfigured } = loadEmailConfig(env({ RESEND_API_KEY: '   ', EMAIL_FROM: '  ' }))
    expect(isConfigured).toBe(false)
    expect(config.from).toBe('Octant <noreply@useoctant.com>')
  })

  it('tolerates surrounding quotes, which survive being pasted into a dashboard field', () => {
    // This exact input used to throw, and the throw was uncaught in the auth hook — a whole signup flow
    // failing over two quote characters, reported only as "Unexpected status code returned from hook: 500".
    expect(loadEmailConfig(env({ EMAIL_FROM: '"Octant <noreply@useoctant.com>"' })).config.from).toBe(
      'Octant <noreply@useoctant.com>',
    )
    expect(loadEmailConfig(env({ EMAIL_FROM: "'Octant <noreply@useoctant.com>'" })).config.from).toBe(
      'Octant <noreply@useoctant.com>',
    )
    expect(loadEmailConfig(env({ EMAIL_SUPPORT: '"help@useoctant.com"' })).config.supportEmail).toBe(
      'help@useoctant.com',
    )
    expect(loadEmailConfig(env({ APP_URL: '"https://app.useoctant.com"' })).config.appUrl).toBe(
      'https://app.useoctant.com',
    )
  })

  it('preserves an RFC 5322 quoted display name', () => {
    // `"Display Name" <addr>` is the canonical form, so the quote-stripping above must not eat these.
    // It doesn't, because the value ends in `>` rather than a matching quote.
    expect(loadEmailConfig(env({ EMAIL_FROM: '"Octant" <noreply@useoctant.com>' })).config.from).toBe(
      '"Octant" <noreply@useoctant.com>',
    )
  })

  it('leaves an unmatched quote alone rather than half-fixing it', () => {
    // Only a matched pair wrapping the whole value is removed. A stray quote stays in the display name,
    // where it is legal — so this is accepted rather than rejected over a cosmetic slip.
    expect(loadEmailConfig(env({ EMAIL_FROM: '"Octant <noreply@useoctant.com>' })).config.from).toBe(
      '"Octant <noreply@useoctant.com>',
    )
  })

  it('accepts both a bare address and a display-name sender', () => {
    expect(loadEmailConfig(env({ EMAIL_FROM: 'noreply@useoctant.com' })).config.from).toBe(
      'noreply@useoctant.com',
    )
    expect(loadEmailConfig(env({ EMAIL_FROM: 'Octant Billing <billing@useoctant.com>' })).config.from).toBe(
      'Octant Billing <billing@useoctant.com>',
    )
  })

  it('throws on a malformed sender rather than letting every send fail at the provider', () => {
    expect(() => loadEmailConfig(env({ EMAIL_FROM: 'not-an-email' }))).toThrow(EmailConfigError)
    expect(() => loadEmailConfig(env({ EMAIL_FROM: 'Octant <broken>' }))).toThrow(EmailConfigError)
  })

  it('throws on a malformed reply-to or support address', () => {
    expect(() => loadEmailConfig(env({ EMAIL_REPLY_TO: 'nope' }))).toThrow(EmailConfigError)
    expect(() => loadEmailConfig(env({ EMAIL_SUPPORT: 'nope' }))).toThrow(EmailConfigError)
  })

  it('reads retry overrides so a provider incident is a secret change, not a redeploy', () => {
    const { config } = loadEmailConfig(
      env({ EMAIL_RETRY_ATTEMPTS: '5', EMAIL_RETRY_BASE_DELAY_MS: '50', EMAIL_RETRY_MAX_DELAY_MS: '900' }),
    )
    expect(config.retry).toEqual({ attempts: 5, baseDelayMs: 50, maxDelayMs: 900 })
  })

  it('rejects a non-numeric retry override instead of silently using NaN', () => {
    expect(() => loadEmailConfig(env({ EMAIL_RETRY_ATTEMPTS: 'lots' }))).toThrow(EmailConfigError)
    expect(() => loadEmailConfig(env({ EMAIL_RETRY_ATTEMPTS: '-1' }))).toThrow(EmailConfigError)
  })
})

describe('extractAddress', () => {
  it('pulls the address out of a display-name sender', () => {
    expect(extractAddress('Octant <noreply@useoctant.com>')).toBe('noreply@useoctant.com')
  })

  it('passes a bare address through', () => {
    expect(extractAddress('noreply@useoctant.com')).toBe('noreply@useoctant.com')
  })
})
