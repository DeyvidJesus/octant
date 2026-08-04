/**
 * The Resend adapter — the ONLY module in the entire repository that imports the Resend SDK.
 *
 * Everything above it depends on the `EmailTransport` / `EmailSuppressionStore` ports, so replacing the
 * provider means adding a sibling file, not editing call sites.
 *
 * Two things worth knowing about the SDK:
 *   • It does NOT throw. Every method resolves to `{ data, error }`, so a caller that forgets to check
 *     `error` silently treats a failure as a success. This adapter is the single place that check lives.
 *   • `Idempotency-Key` is a first-class option, which is what makes `withRetry` safe: replaying the
 *     same key returns the original message instead of sending a second copy.
 */

import { Resend } from 'resend'
import {
  EmailRateLimitError,
  EmailSuppressedError,
  EmailTransportError,
  EmailValidationError,
} from '../errors.ts'
import type { OutboundEmail, TransportResult } from '../types.ts'
import type {
  EmailSuppressionStore,
  EmailTransport,
  EmailWebhookVerifier,
  TransportSendOptions,
} from './EmailTransport.ts'

const PROVIDER = 'resend'

/** Resend's `error.name` values that mean "the request itself is wrong" — retrying cannot help. */
const PERMANENT_CODES = new Set([
  'validation_error',
  'missing_api_key',
  'restricted_api_key',
  'invalid_api_key',
  'not_found',
  'method_not_allowed',
  'invalid_attachment',
  'invalid_from_address',
  'invalid_access',
  'invalid_parameter',
  'invalid_region',
  'missing_required_field',
  'invalid_idempotency_key',
  'security_error',
])

/** Codes that mean "the same request may work shortly". */
const TRANSIENT_CODES = new Set([
  'application_error',
  'internal_server_error',
  // A concurrent replay of our own idempotency key: the first attempt is still in flight, so backing
  // off and asking again is exactly right.
  'concurrent_idempotent_requests',
])

/** Codes that mean "you are over your allowance" — transient, but the wait is longer. */
const RATE_LIMIT_CODES = new Set(['rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded'])

interface ResendErrorShape {
  message: string
  statusCode: number | null
  name: string
}

/**
 * Resend returns Retry-After in seconds on 429s. Absent or unparseable → null, and the caller falls
 * back to exponential backoff.
 */
function parseRetryAfterMs(headers: Record<string, string> | null): number | null {
  const raw = headers?.['retry-after'] ?? headers?.['Retry-After']
  if (raw === undefined) return null
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : null
}

/** Translates Resend's `{ message, statusCode, name }` into this package's typed errors. */
function toEmailError(
  error: ResendErrorShape,
  headers: Record<string, string> | null,
  recipient: string,
): Error {
  const detail = `Resend rejected the message (${error.name}). ${error.message}`.trim()

  if (RATE_LIMIT_CODES.has(error.name)) {
    return new EmailRateLimitError(detail, {
      status: error.statusCode,
      providerCode: error.name,
      retryAfterMs: parseRetryAfterMs(headers),
    })
  }
  if (error.name === 'validation_error' || error.name === 'invalid_parameter' || error.name === 'missing_required_field') {
    return new EmailValidationError(detail)
  }
  // Resend reports a suppressed recipient as a 403 security_error mentioning suppression; treat that as
  // a permanent, non-alarming refusal rather than a generic transport failure.
  if (error.name === 'security_error' && /suppress/i.test(error.message)) {
    return new EmailSuppressedError(recipient, { cause: new Error(detail) })
  }

  const retryable = TRANSIENT_CODES.has(error.name)
    ? true
    : PERMANENT_CODES.has(error.name)
      ? false
      // Unknown code: fall back to the status class. 5xx and 408 are worth another try.
      : error.statusCode === null || error.statusCode >= 500 || error.statusCode === 408

  return new EmailTransportError(detail, {
    status: error.statusCode,
    retryable,
    providerCode: error.name,
  })
}

/** Wraps a network-level throw (no HTTP response at all) as retryable. */
function toNetworkError(cause: unknown): EmailTransportError {
  const message = cause instanceof Error ? cause.message : String(cause)
  return new EmailTransportError(`Could not reach Resend. ${message}`.trim(), {
    retryable: true,
    cause,
  })
}

export interface ResendTransportDeps {
  apiKey: string
  /** Pre-built client, for tests that want to stub the SDK without a real key. */
  client?: Resend
}

export function createResendTransport(deps: ResendTransportDeps): EmailTransport {
  const client = deps.client ?? new Resend(deps.apiKey)

  return {
    name: PROVIDER,
    async send(email: OutboundEmail, options: TransportSendOptions): Promise<TransportResult> {
      let response
      try {
        response = await client.emails.send(
          {
            from: email.from,
            to: email.to,
            subject: email.subject,
            html: email.html,
            text: email.text,
            replyTo: email.replyTo,
            headers: email.headers,
            tags: email.tags,
          },
          { idempotencyKey: options.idempotencyKey },
        )
      } catch (cause) {
        throw toNetworkError(cause)
      }

      if (response.error !== null) {
        throw toEmailError(response.error, response.headers, email.to)
      }
      return { id: response.data?.id ?? null, provider: PROVIDER }
    },
  }
}

/**
 * Inbound webhook verification, using the SDK's own Standard Webhooks implementation.
 *
 * Exists so the webhook Edge Function never imports `resend` itself — otherwise the rule that this file
 * is the single point of contact with the SDK would hold everywhere except the one place handling
 * untrusted input. `verify` throws on a bad signature.
 */
export function createResendWebhookVerifier(deps: ResendTransportDeps): EmailWebhookVerifier {
  const client = deps.client ?? new Resend(deps.apiKey)
  return {
    name: PROVIDER,
    verify(input) {
      // The SDK wants the three Standard Webhooks values individually, not the request's header bag.
      // Resend sends them `svix-*`; the spec's vendor-neutral `webhook-*` names are accepted as a
      // fallback so a future rename doesn't break verification.
      const read = (name: string): string =>
        input.headers.get(`svix-${name}`) ?? input.headers.get(`webhook-${name}`) ?? ''

      const id = read('id')
      const timestamp = read('timestamp')
      const signature = read('signature')
      if (id === '' || timestamp === '' || signature === '') {
        // Throwing keeps the contract: an implementation must never hand back an unverified payload.
        throw new EmailTransportError('Webhook request is missing its signature headers.', {
          status: 400,
          retryable: false,
          providerCode: 'missing_signature_headers',
        })
      }

      return client.webhooks.verify({
        payload: input.payload,
        headers: { id, timestamp, signature },
        webhookSecret: input.webhookSecret,
      })
    },
  }
}

/**
 * Suppression list backed by Resend's own API, so we don't maintain a parallel copy that can drift
 * from the provider's view of who has bounced.
 */
export function createResendSuppressions(deps: ResendTransportDeps): EmailSuppressionStore {
  const client = deps.client ?? new Resend(deps.apiKey)

  return {
    name: PROVIDER,
    async add(email: string): Promise<void> {
      const { error, headers } = await client.suppressions.add({ email })
      // Already suppressed is the desired end state, so don't turn it into a failure.
      if (error !== null && error.name !== 'validation_error') throw toEmailError(error, headers, email)
    },
    async remove(email: string): Promise<void> {
      const { error, headers } = await client.suppressions.remove(email)
      if (error !== null && error.name !== 'not_found') throw toEmailError(error, headers, email)
    },
    async has(email: string): Promise<boolean> {
      const { data, error } = await client.suppressions.get(email)
      // Fails OPEN on purpose. An inconclusive lookup (provider outage, auth blip) must not silently
      // block every outgoing message — the send call itself still refuses a genuinely suppressed
      // recipient, so the worst case is one wasted API call rather than a total mail outage.
      if (error !== null) return false
      return data !== null
    },
  }
}
