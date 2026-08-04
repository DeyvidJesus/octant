/**
 * Test double and dev no-op.
 *
 * Two jobs:
 *   1. In tests, records what would have been sent so assertions read against real rendered output.
 *   2. In any environment without `RESEND_API_KEY`, `createEmailService` composes this instead of the
 *      Resend adapter — the same env-gate pattern as `src/services/monitoring/sentry.ts` and
 *      `src/services/analytics/analytics.ts`. Dev and CI therefore never send real email, and nothing
 *      throws just because email isn't configured.
 *
 * `failWith` exists so the retry path can be exercised without touching the network.
 */

import type { OutboundEmail, TransportResult } from '../types.ts'
import type { EmailTransport, TransportSendOptions } from './EmailTransport.ts'

export interface RecordedEmail {
  email: OutboundEmail
  options: TransportSendOptions
}

export interface InMemoryTransport extends EmailTransport {
  /** Every accepted message, in order. */
  readonly sent: RecordedEmail[]
  /** How many times `send` was invoked, including attempts that threw. */
  readonly attempts: number
  /**
   * Makes the next `remaining` calls throw `error`. Used to assert that `withRetry` retries the right
   * failures and gives up on the rest.
   */
  failWith(error: unknown, remaining?: number): void
  reset(): void
}

export function createInMemoryTransport(name = 'in-memory'): InMemoryTransport {
  const sent: RecordedEmail[] = []
  let attempts = 0
  let pendingFailure: { error: unknown; remaining: number } | null = null

  return {
    name,
    get sent() {
      return sent
    },
    get attempts() {
      return attempts
    },
    failWith(error: unknown, remaining = Number.POSITIVE_INFINITY) {
      pendingFailure = { error, remaining }
    },
    reset() {
      sent.length = 0
      attempts = 0
      pendingFailure = null
    },
    send(email: OutboundEmail, options: TransportSendOptions): Promise<TransportResult> {
      attempts += 1

      if (pendingFailure !== null && pendingFailure.remaining > 0) {
        pendingFailure.remaining -= 1
        const { error } = pendingFailure
        if (pendingFailure.remaining <= 0) pendingFailure = null
        return Promise.reject(error)
      }

      // Idempotency is part of the contract, so honour it here too: replaying a key returns the
      // original result instead of recording a second delivery.
      const replayed = sent.findIndex((record) => record.options.idempotencyKey === options.idempotencyKey)
      if (replayed !== -1) return Promise.resolve({ id: `in-memory-${replayed}`, provider: name })

      sent.push({ email, options })
      return Promise.resolve({ id: `in-memory-${sent.length - 1}`, provider: name })
    },
  }
}
