// Transport-agnostic value types; nothing here is Resend-specific.

import type { TemplateName } from './templates/props.ts'

/** The output of rendering one template. */
export interface RenderedEmail {
  subject: string
  html: string
  /** Plain-text alternative, generated from the same React tree. */
  text: string
}

/** A fully addressed, fully rendered message, ready for a transport. */
export interface OutboundEmail extends RenderedEmail {
  /** Single recipient by design: transactional email is 1:1. */
  to: string
  /** RFC 5322 sender, e.g. `Octant <noreply@useoctant.com>`. */
  from: string
  replyTo?: string
  headers?: Record<string, string>
  /** Provider-side labels; values must be ASCII letters, digits, underscore or dash. */
  tags?: Array<{ name: string; value: string }>
}

/** What a transport reports back after accepting a message. */
export interface TransportResult {
  /** Provider-side message id, when the provider issues one. */
  id: string | null
  /** Adapter name, recorded in `email_log.metadata` to tell real sends from no-ops. */
  provider: string
}

/** Per-send options a caller may override. */
export interface SendOptions {
  /** Separates distinct sends of one template to one person (e.g. two resets); part of the idempotency key. */
  dedupeKey?: string
  /** Owner of the message; used in the idempotency key instead of the address. */
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
  /** The key that de-duplicated this send, for the caller to write to `email_log`. */
  idempotencyKey: string
  /** True when no provider call happened because email is not configured. */
  skipped: boolean
  provider: string
}

export type { TemplateName }
