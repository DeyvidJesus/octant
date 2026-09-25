// Provider ports. `EmailService` depends only on these, which keeps the Resend SDK in one adapter file.

import type { OutboundEmail, TransportResult } from '../types.ts'

export interface TransportSendOptions {
  /** Required: `withRetry` re-issues the same request on a 5xx or dropped connection. */
  idempotencyKey: string
}

export interface EmailTransport {
  /** Adapter identifier recorded on the send result (e.g. `resend`, `in-memory`). */
  readonly name: string
  /** Delivers the message or throws a typed `EmailError`; never a partial success. */
  send(email: OutboundEmail, options: TransportSendOptions): Promise<TransportResult>
}

/** Inbound webhook verification. Must throw on an invalid signature, never return a falsy value. */
export interface EmailWebhookVerifier {
  readonly name: string
  verify(input: { payload: string; headers: Headers; webhookSecret: string }): unknown
}

/** Suppression list, separate from the send path; only the provider webhook writes to it. */
export interface EmailSuppressionStore {
  readonly name: string
  /** Stops all future delivery to `email`. Idempotent. */
  add(email: string): Promise<void>
  /** Lifts a suppression, e.g. after a user fixes a typo'd address. */
  remove(email: string): Promise<void>
  /** Whether the provider is currently suppressing `email`. */
  has(email: string): Promise<boolean>
}
