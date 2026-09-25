// Records sends for tests, and is the no-op transport whenever `RESEND_API_KEY` is unset.

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
  /** Makes the next `remaining` calls throw `error`, to exercise the retry path. */
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

      // Honour idempotency like a real provider: a replayed key returns the original result.
      const replayed = sent.findIndex((record) => record.options.idempotencyKey === options.idempotencyKey)
      if (replayed !== -1) return Promise.resolve({ id: `in-memory-${replayed}`, provider: name })

      sent.push({ email, options })
      return Promise.resolve({ id: `in-memory-${sent.length - 1}`, provider: name })
    },
  }
}
