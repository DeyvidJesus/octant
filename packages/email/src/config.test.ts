import { describe, expect, it } from 'vitest'
import { EmailConfigError } from './errors.ts'
import { extractAddress, loadEmailConfig, type EnvReader } from './config.ts'

/** Env reader over a plain object. */
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
    // This used to throw uncaught in the auth hook and break signup with a bare 500.
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
    // Not stripped: the value ends in `>`, not a matching quote.
    expect(loadEmailConfig(env({ EMAIL_FROM: '"Octant" <noreply@useoctant.com>' })).config.from).toBe(
      '"Octant" <noreply@useoctant.com>',
    )
  })

  it('leaves an unmatched quote alone rather than half-fixing it', () => {
    // Only a matched pair wrapping the whole value is removed; a stray quote is legal in a display name.
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
