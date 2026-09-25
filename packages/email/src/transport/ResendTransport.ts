// The only module that imports the Resend SDK. The SDK resolves to `{ data, error }` instead of throwing,
// and replaying an idempotency key returns the original message, which is what makes retries safe.

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

/** Resend `error.name` values where the request itself is wrong, so retrying cannot help. */
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

/** Codes where the same request may succeed shortly. */
const TRANSIENT_CODES = new Set([
  'application_error',
  'internal_server_error',
  // Our own idempotency key is still in flight from an earlier attempt, so back off and retry.
  'concurrent_idempotent_requests',
])

/** Over-quota codes: transient, but with a longer wait. */
const RATE_LIMIT_CODES = new Set(['rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded'])

interface ResendErrorShape {
  message: string
  statusCode: number | null
  name: string
}

/** Retry-After (seconds) from a 429; null when absent or unparseable, so the caller uses backoff. */
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
  // Resend reports a suppressed recipient as a 403 security_error mentioning suppression.
  if (error.name === 'security_error' && /suppress/i.test(error.message)) {
    return new EmailSuppressedError(recipient, { cause: new Error(detail) })
  }

  const retryable = TRANSIENT_CODES.has(error.name)
    ? true
    : PERMANENT_CODES.has(error.name)
      ? false
      // Unknown code: retry on 5xx, 408 or no status.
      : error.statusCode === null || error.statusCode >= 500 || error.statusCode === 408

  return new EmailTransportError(detail, {
    status: error.statusCode,
    retryable,
    providerCode: error.name,
  })
}

/** A network-level throw (no HTTP response) is retryable. */
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

/** Standard Webhooks verification via the SDK, so the webhook function never imports `resend`. Throws on a bad signature. */
export function createResendWebhookVerifier(deps: ResendTransportDeps): EmailWebhookVerifier {
  const client = deps.client ?? new Resend(deps.apiKey)
  return {
    name: PROVIDER,
    verify(input) {
      // Resend sends `svix-*` headers; the spec's neutral `webhook-*` names are a fallback in case
      // that changes.
      const read = (name: string): string =>
        input.headers.get(`svix-${name}`) ?? input.headers.get(`webhook-${name}`) ?? ''

      const id = read('id')
      const timestamp = read('timestamp')
      const signature = read('signature')
      if (id === '' || timestamp === '' || signature === '') {
        // Never hand back an unverified payload.
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

/** Suppression list backed by Resend's API, so there is no local copy to drift out of sync. */
export function createResendSuppressions(deps: ResendTransportDeps): EmailSuppressionStore {
  const client = deps.client ?? new Resend(deps.apiKey)

  return {
    name: PROVIDER,
    async add(email: string): Promise<void> {
      const { error, headers } = await client.suppressions.add({ email })
      // Already suppressed is the desired end state, not a failure.
      if (error !== null && error.name !== 'validation_error') throw toEmailError(error, headers, email)
    },
    async remove(email: string): Promise<void> {
      const { error, headers } = await client.suppressions.remove(email)
      if (error !== null && error.name !== 'not_found') throw toEmailError(error, headers, email)
    },
    async has(email: string): Promise<boolean> {
      const { data, error } = await client.suppressions.get(email)
      // Fails open: a failed lookup must not block all mail, and the send itself still refuses a
      // suppressed recipient.
      if (error !== null) return false
      return data !== null
    },
  }
}
