/**
 * Transport-agnostic value types.
 *
 * Nothing here mentions Resend. `OutboundEmail` is what any provider adapter must be able to send,
 * and `SendResult` is what every `EmailService.send*` method returns — so swapping providers, or
 * running against `InMemoryTransport` in tests, changes no caller.
 */

import type { TemplateName } from './templates/props.ts'

/** The output of rendering one template: what actually goes on the wire. */
export interface RenderedEmail {
  subject: string
  html: string
  /** Plain-text alternative, generated from the same React tree — never hand-maintained. */
  text: string
}

/** A fully addressed, fully rendered message, ready for a transport. */
export interface OutboundEmail extends RenderedEmail {
  /** Single recipient by design: transactional email is always 1:1, which keeps logging honest. */
  to: string
  /** RFC 5322 sender, e.g. `Octant <noreply@useoctant.com>`. */
  from: string
  replyTo?: string
  headers?: Record<string, string>
  /** Provider-side analytics labels. Values must be ASCII alphanumeric/underscore/dash. */
  tags?: Array<{ name: string; value: string }>
}

/** What a transport reports back after accepting a message. */
export interface TransportResult {
  /** Provider-side message id, when the provider issues one. */
  id: string | null
  /** Adapter name, recorded in `email_log.metadata` so we can tell real sends from no-ops. */
  provider: string
}

/** Per-send options a caller may override. */
export interface SendOptions {
  /**
   * Distinguishes two legitimately different sends of the same template to the same person (e.g. two
   * separate password resets). Folded into the idempotency key; identical values collapse into one
   * send, both at the provider and in `email_log`.
   */
  dedupeKey?: string
  /** Owner of the message, when known. Recorded on the log row and used in the idempotency key. */
  userId?: string
  /** Overrides the configured Reply-To for this message only. */
  replyTo?: string
  /** Extra provider-side analytics tags, merged with the template tag. */
  tags?: Array<{ name: string; value: string }>
  /** Per-recipient notification-preferences URL, surfaced in the footer. */
  preferencesUrl?: string
}

/** The outcome of one `EmailService.send*` call. */
export interface SendResult {
  /** Provider message id; `null` when the send was a no-op or the provider issued none. */
  id: string | null
  template: TemplateName
  to: string
  subject: string
  /** The key that de-duplicated this send, persisted so the caller can write it to `email_log`. */
  idempotencyKey: string
  /** True when no provider call happened because email is not configured in this environment. */
  skipped: boolean
  provider: string
}

export type { TemplateName }
