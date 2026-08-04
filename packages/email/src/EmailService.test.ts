import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EmailService, createEmailService } from './EmailService.ts'
import { EmailRenderError, EmailTransportError, EmailValidationError } from './errors.ts'
import { createInMemoryTransport, type InMemoryTransport } from './transport/InMemoryTransport.ts'
import { TEMPLATE_NAMES, templateRegistry } from './registry.ts'
import { templateFixtures } from './templates/fixtures.ts'
import type { EmailConfig } from './config.ts'
import type { RetryDeps } from './transport/retry.ts'

const CONFIG: EmailConfig = {
  from: 'Octant <noreply@useoctant.com>',
  replyTo: 'support@useoctant.com',
  appUrl: 'https://app.useoctant.com',
  supportEmail: 'support@useoctant.com',
  appName: 'Octant',
  apiKey: 're_test',
  retry: { attempts: 3, baseDelayMs: 10, maxDelayMs: 40 },
}

/** No real waiting, pinned jitter — the retry path is asserted, not timed. */
const RETRY_DEPS: RetryDeps = { sleep: () => Promise.resolve(), random: () => 1 }

/**
 * The service logs through plain `console` (house convention, `[email]` prefix). Stubbing the three
 * methods keeps a passing run silent AND gives the log assertions something to inspect — the same thing
 * an injected logger did, without the abstraction.
 *
 * `ConsoleSpy` is a structural view of the spy: enough to read what was logged, without importing
 * vitest's generic mock types into every assertion.
 */
interface ConsoleSpy {
  mock: { calls: unknown[][] }
}

/** First argument of every recorded call, stringified. Each log call here passes one message. */
function loggedLines(spy: ConsoleSpy): string[] {
  return spy.mock.calls.map((call) => String(call[0]))
}

let consoleWarn: ConsoleSpy
let consoleInfo: ConsoleSpy
let consoleError: ConsoleSpy

beforeEach(() => {
  consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {})
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

function build(overrides?: Partial<EmailConfig>): { service: EmailService; transport: InMemoryTransport } {
  const transport = createInMemoryTransport()
  const service = new EmailService({
    transport,
    config: { ...CONFIG, ...overrides },
    retryDeps: RETRY_DEPS,
  })
  return { service, transport }
}

describe('EmailService — envelope', () => {
  it('sends from the configured sender with the configured reply-to', async () => {
    const { service, transport } = build()
    await service.sendWelcome('ana@example.com', { name: 'Ana' })

    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0].email.from).toBe('Octant <noreply@useoctant.com>')
    expect(transport.sent[0].email.replyTo).toBe('support@useoctant.com')
    expect(transport.sent[0].email.to).toBe('ana@example.com')
  })

  it('lets a caller override reply-to per message', async () => {
    const { service, transport } = build()
    await service.sendBillingSuccess(
      'ana@example.com',
      { planName: 'Pro', amountFormatted: 'R$ 49,00' },
      { replyTo: 'billing@useoctant.com' },
    )
    expect(transport.sent[0].email.replyTo).toBe('billing@useoctant.com')
  })

  it('ships both an HTML and a plain-text part', async () => {
    const { service, transport } = build()
    await service.sendWelcome('ana@example.com', {})

    const { email } = transport.sent[0]
    expect(email.html).toContain('<!DOCTYPE html')
    expect(email.text.length).toBeGreaterThan(80)
    expect(email.text).not.toContain('<!DOCTYPE')
  })

  it('suppresses auto-responders so out-of-office replies do not bounce back', async () => {
    const { service, transport } = build()
    await service.sendWelcome('ana@example.com', {})

    expect(transport.sent[0].email.headers).toMatchObject({
      'X-Auto-Response-Suppress': 'All',
      'Auto-Submitted': 'auto-generated',
    })
  })

  it('tags every message with its template, and merges caller tags', async () => {
    const { service, transport } = build()
    await service.sendPaymentFailed('ana@example.com', {}, { tags: [{ name: 'source', value: 'stripe' }] })

    expect(transport.sent[0].email.tags).toEqual([
      { name: 'template', value: 'payment-failed' },
      { name: 'source', value: 'stripe' },
    ])
  })

  it('trims the recipient and rejects a malformed one', async () => {
    const { service, transport } = build()
    await service.sendWelcome('  ana@example.com  ', {})
    expect(transport.sent[0].email.to).toBe('ana@example.com')

    await expect(service.sendWelcome('not-an-email', {})).rejects.toThrow(EmailValidationError)
  })
})

describe('EmailService — idempotency', () => {
  it('produces a stable key for the same logical send', () => {
    const { service } = build()
    const first = service.buildIdempotencyKey('welcome', 'ana@example.com')
    const second = service.buildIdempotencyKey('welcome', 'ana@example.com')
    expect(first).toBe(second)
    // The template prefix stays readable so the key is diagnosable in provider logs.
    expect(first.startsWith('welcome-')).toBe(true)
  })

  it('is case-insensitive on the recipient, so ANA@ and ana@ do not double-send', () => {
    const { service } = build()
    expect(service.buildIdempotencyKey('welcome', 'ANA@example.com')).toBe(
      service.buildIdempotencyKey('welcome', 'ana@example.com'),
    )
  })

  it('keys on userId when given, so a changed address still de-duplicates', () => {
    const { service } = build()
    expect(service.buildIdempotencyKey('welcome', 'new@example.com', { userId: 'u1' })).toBe(
      service.buildIdempotencyKey('welcome', 'old@example.com', { userId: 'u1' }),
    )
  })

  it('separates different templates and different dedupe keys', () => {
    const { service } = build()
    const welcome = service.buildIdempotencyKey('welcome', 'ana@example.com')
    const reset = service.buildIdempotencyKey('password-reset', 'ana@example.com')
    const secondReset = service.buildIdempotencyKey('password-reset', 'ana@example.com', {
      dedupeKey: 'req-2',
    })

    expect(welcome).not.toBe(reset)
    expect(reset).not.toBe(secondReset)
  })

  it('collapses a repeated send into one delivery', async () => {
    const { service, transport } = build()
    await service.sendWelcome('ana@example.com', {})
    await service.sendWelcome('ana@example.com', {})

    expect(transport.attempts).toBe(2)
    expect(transport.sent).toHaveLength(1)
  })

  it('returns the key so the caller can persist it to email_log', async () => {
    const { service } = build()
    const result = await service.sendWelcome('ana@example.com', {})
    expect(result.idempotencyKey).toBe(service.buildIdempotencyKey('welcome', 'ana@example.com'))
  })
})

describe('EmailService — failure handling', () => {
  it('retries a transient provider failure and then succeeds', async () => {
    const { service, transport } = build()
    transport.failWith(new EmailTransportError('502', { retryable: true }), 1)

    const result = await service.sendWelcome('ana@example.com', {})
    expect(result.skipped).toBe(false)
    expect(transport.attempts).toBe(2)
  })

  it('throws a typed transport error once attempts are exhausted', async () => {
    const { service, transport } = build()
    transport.failWith(new EmailTransportError('still down', { retryable: true }))

    await expect(service.sendWelcome('ana@example.com', {})).rejects.toThrow(EmailTransportError)
    expect(transport.attempts).toBe(3)
  })

  it('does not retry a permanent failure', async () => {
    const { service, transport } = build()
    transport.failWith(new EmailValidationError('rejected by provider'))

    await expect(service.sendWelcome('ana@example.com', {})).rejects.toThrow(EmailValidationError)
    expect(transport.attempts).toBe(1)
  })

  it('logs the permanent failure with a machine-readable code', async () => {
    const { service, transport } = build()
    transport.failWith(new EmailValidationError('rejected'))

    await expect(service.sendWelcome('ana@example.com', {})).rejects.toThrow()

    const logged = loggedLines(consoleError).join('\n')
    expect(logged).toContain('[email]')
    expect(logged).toContain('welcome')
    // The stable code, not just the prose — that is what makes the log searchable.
    expect(logged).toContain('EMAIL_VALIDATION')
  })

  it('logs each retry with the attempt number and the delay', async () => {
    const { service, transport } = build()
    transport.failWith(new EmailTransportError('502', { retryable: true }), 1)

    await service.sendWelcome('ana@example.com', {})

    const logged = loggedLines(consoleWarn).join('\n')
    expect(logged).toContain('attempt 1')
    expect(logged).toContain('retrying')
  })

  it('logs a successful send once, with the provider message id', async () => {
    const { service } = build()
    await service.sendWelcome('ana@example.com', {})

    expect(loggedLines(consoleInfo)).toHaveLength(1)
    expect(loggedLines(consoleInfo)[0]).toContain('[email] sent welcome to ana@example.com')
  })

  it('surfaces a render failure instead of sending a broken email', async () => {
    const { service, transport } = build()
    // A subject builder is the one part of a template that runs before render.
    const original = templateRegistry.welcome.subject
    templateRegistry.welcome.subject = () => ''
    try {
      await expect(service.sendWelcome('ana@example.com', {})).rejects.toThrow(EmailRenderError)
      expect(transport.sent).toHaveLength(0)
    } finally {
      templateRegistry.welcome.subject = original
    }
  })
})

describe('EmailService — unconfigured environment', () => {
  it('skips the send instead of throwing when there is no API key', async () => {
    const { service, transport } = build({ apiKey: undefined })
    const result = await service.sendWelcome('ana@example.com', {})

    expect(result.skipped).toBe(true)
    expect(result.id).toBeNull()
    expect(result.provider).toBe('noop')
    expect(transport.sent).toHaveLength(0)
  })

  it('still renders, so a broken template fails in dev and not only in production', async () => {
    const { service } = build({ apiKey: undefined })
    const result = await service.sendBillingSuccess('ana@example.com', {
      planName: 'Pro',
      amountFormatted: 'R$ 49,00',
    })
    // The subject proves the template was rendered even though nothing was sent.
    expect(result.subject).toBe('Your Octant receipt — R$ 49,00')
  })

  it('reports isConfigured honestly', () => {
    expect(build().service.isConfigured).toBe(true)
    expect(build({ apiKey: undefined }).service.isConfigured).toBe(false)
  })
})

describe('createEmailService', () => {
  it('composes a no-op transport when unconfigured, and logs the warnings once', async () => {
    const service = createEmailService({
      config: { ...CONFIG, apiKey: undefined },
      warnings: ['RESEND_API_KEY is not set — email sending is disabled and every send is a no-op.'],
    })

    const logged = loggedLines(consoleWarn)
    expect(logged.filter((line) => line.includes('RESEND_API_KEY'))).toHaveLength(1)
    expect(logged[0]).toContain('[email]')
    await expect(service.sendWelcome('ana@example.com', {})).resolves.toMatchObject({ skipped: true })
  })

  it('honours an injected transport', async () => {
    const transport = createInMemoryTransport('stub')
    const service = createEmailService({ config: CONFIG, transport, retryDeps: RETRY_DEPS })

    const result = await service.sendWelcome('ana@example.com', {})
    expect(result.provider).toBe('stub')
    expect(transport.sent).toHaveLength(1)
  })
})

/**
 * Covers every public `send*` method through the generic `send()` entry point, so a new template with a
 * typo'd registry wiring fails here rather than in production. Uses the shared fixtures, minus the
 * injected `brand`.
 */
describe.each(TEMPLATE_NAMES)('EmailService.send("%s")', (name) => {
  it('renders and delivers with the registry subject', async () => {
    const { service, transport } = build()
    const { brand: _brand, ...props } = templateFixtures[name]

    const result = await service.send(name, 'ana@example.com', props as never)

    expect(result.skipped).toBe(false)
    expect(result.template).toBe(name)
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0].email.subject).toBe(result.subject)
    expect(transport.sent[0].email.tags?.[0]).toEqual({ name: 'template', value: name })
  })
})
