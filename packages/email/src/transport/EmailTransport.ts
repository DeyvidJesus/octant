/**
 * The provider port.
 *
 * `EmailService` depends on this interface and nothing else, so the Resend SDK is confined to a single
 * adapter file (`ResendTransport.ts`). Swapping providers, or running the whole service against
 * `InMemoryTransport` in tests, requires no change above this line.
 */

import type { OutboundEmail, TransportResult } from '../types.ts'

export interface TransportSendOptions {
  /**
   * Required, not optional. Every send must be replayable without duplicating delivery, because
   * `withRetry` will re-issue this exact request on a 5xx or a dropped connection.
   */
  idempotencyKey: string
}

export interface EmailTransport {
  /** Adapter identifier recorded on the send result (e.g. `resend`, `in-memory`). */
  readonly name: string
  /** Delivers the message or throws a typed `EmailError`. Must never return a partial success. */
  send(email: OutboundEmail, options: TransportSendOptions): Promise<TransportResult>
}

/**
 * Inbound-webhook verification port.
 *
 * Segregated from the send path because only the webhook function needs it — and because putting it
 * behind a port is what keeps the provider SDK confined to one adapter file. Implementations must throw
 * on an invalid signature, never return a falsy value, so a caller cannot forget to check.
 */
export interface EmailWebhookVerifier {
  readonly name: string
  verify(input: { payload: string; headers: Headers; webhookSecret: string }): unknown
}

/**
 * Suppression-list port. Kept separate from `EmailTransport` (interface segregation): the send path
 * has no business knowing about suppressions, and only the provider webhook needs to write them.
 */
export interface EmailSuppressionStore {
  readonly name: string
  /** Stops all future delivery to `email`. Idempotent. */
  add(email: string): Promise<void>
  /** Lifts a suppression, e.g. after a user fixes a typo'd address. */
  remove(email: string): Promise<void>
  /** Whether the provider is currently suppressing `email`. */
  has(email: string): Promise<boolean>
}
