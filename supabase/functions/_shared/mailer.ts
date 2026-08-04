// Shared email plumbing for Edge Functions.
//
// Two responsibilities, both deliberately thin — all the real logic lives in `@octant/email`, which is
// unit-tested under vitest. Anything left in here runs only under Deno and is therefore effectively
// untested, so it stays as close to wiring as possible.
//
//   1. `getEmailService()` — the composition root. Reads config from Deno's env once per isolate.
//   2. `sendLogged()`      — the claim → send → record pipeline every caller uses, so idempotency and
//                            delivery logging are never re-implemented per function.
//
// These files are inlined into each function's `index.ts` by `scripts/bundle-functions.mjs`. The
// `@octant/email` specifier is an esbuild alias for `packages/email/src`, resolved at bundle time —
// there is no npm package by that name, and Deno could not resolve one anyway.

import {
  createEmailService,
  describeEmailError,
  loadEmailConfig,
  type EmailService,
  type TemplateDefinitions,
  type TemplateName,
} from '@octant/email'

// deno-lint-ignore no-explicit-any
type Admin = any

let cached: EmailService | null = null

/**
 * The EmailService for this isolate. Cached because Edge Function isolates are reused across requests,
 * and re-reading env plus re-constructing the Resend client per request is pure waste.
 *
 * With no `RESEND_API_KEY` this returns a service whose sends are no-ops — the same env-gating the app
 * uses for Sentry and PostHog. A dev or preview deployment therefore never fails just because email
 * isn't configured.
 */
export function getEmailService(): EmailService {
  if (cached !== null) return cached
  const { config, warnings } = loadEmailConfig((key) => Deno.env.get(key))
  cached = createEmailService({ config, warnings })
  return cached
}

/** Everything `sendLogged` needs. `template` and `props` are correlated, so a mismatch won't compile. */
export interface SendLoggedInput<N extends TemplateName> {
  template: N
  to: string
  props: TemplateDefinitions[N]
  /** Owner of the message, when known. Also keys de-duplication. */
  userId?: string
  /** Distinguishes genuinely separate sends of the same template to the same person. */
  dedupeKey?: string
  preferencesUrl?: string
  /** Extra context recorded on the log row — the Stripe event id, the auth action, etc. */
  metadata?: Record<string, unknown>
}

export type SendLoggedOutcome =
  | { status: 'sent'; id: string | null }
  /** An identical send already happened (or is in flight). Callers treat this as success. */
  | { status: 'deduped' }
  /** Email isn't configured in this environment; nothing was attempted. */
  | { status: 'skipped' }
  | { status: 'failed'; code: string; message: string }

/**
 * Claims, sends, and records one email.
 *
 * The claim comes FIRST, and that ordering is the whole point: inserting the `email_log` row before
 * calling Resend turns the table's UNIQUE constraint on `idempotency_key` into a distributed lock. Two
 * concurrent Stripe deliveries of the same event, or a user double-clicking, race on the insert — one
 * wins and sends, the other gets a conflict and returns `deduped`. Recording only after sending would
 * leave that window wide open.
 *
 * The provider ALSO de-duplicates on the same key (Resend's `Idempotency-Key`), so even a crash between
 * claim and send cannot produce two delivered messages.
 *
 * Never throws. A failed send is logged, recorded and reported — callers are webhooks, and a 5xx there
 * makes the provider redeliver an event whose database work already succeeded.
 */
export async function sendLogged<N extends TemplateName>(
  admin: Admin,
  input: SendLoggedInput<N>,
): Promise<SendLoggedOutcome> {
  const options = {
    userId: input.userId,
    dedupeKey: input.dedupeKey,
    preferencesUrl: input.preferencesUrl,
  }

  // Inside the guard, not above it: `loadEmailConfig` throws on a malformed EMAIL_FROM, and
  // `subjectFor` runs a template's subject builder. Both were previously outside any try/catch, so a
  // config typo escaped as an opaque 500 from the caller — breaking the documented "never throws"
  // contract at the one moment it mattered most.
  let mailer: EmailService
  let idempotencyKey: string
  let subject: string
  try {
    mailer = getEmailService()
    idempotencyKey = mailer.buildIdempotencyKey(input.template, input.to, options)
    // Computed without rendering, so the claim row can carry a real subject.
    subject = mailer.subjectFor(input.template, input.props, options)
  } catch (error) {
    const described = describeEmailError(error)
    console.error(`[email] could not prepare ${input.template}: ${described.code} ${described.message}`)
    return { status: 'failed', ...described }
  }

  const { error: claimError } = await admin.from('email_log').insert({
    user_id: input.userId ?? null,
    to_email: input.to,
    template: input.template,
    subject,
    status: 'queued',
    idempotency_key: idempotencyKey,
    metadata: input.metadata ?? {},
  })

  if (claimError !== null) {
    // 23505 = unique_violation on idempotency_key → this exact email was already handled.
    if (claimError.code === '23505') {
      console.info(`[email] deduped ${input.template} for ${input.to}`)
      return { status: 'deduped' }
    }
    // Any other database failure means we cannot guarantee we won't double-send, so don't send at all.
    console.error(`[email] could not claim ${input.template}: ${claimError.message}`)
    return { status: 'failed', code: 'EMAIL_LOG_CLAIM', message: claimError.message }
  }

  try {
    const result = await mailer.send(input.template, input.to, input.props, options)

    await admin
      .from('email_log')
      .update({
        status: result.skipped ? 'skipped' : 'sent',
        provider: result.provider,
        provider_message_id: result.id,
      })
      .eq('idempotency_key', idempotencyKey)

    return result.skipped ? { status: 'skipped' } : { status: 'sent', id: result.id }
  } catch (error) {
    const described = describeEmailError(error)
    await admin
      .from('email_log')
      .update({ status: 'failed', error_code: described.code, error_message: described.message })
      .eq('idempotency_key', idempotencyKey)

    console.error(`[email] ${input.template} to ${input.to} failed: ${described.code} ${described.message}`)
    return { status: 'failed', ...described }
  }
}

/**
 * Resolves the footer preferences link for a user, creating their preferences row on first use.
 * Returns `undefined` on any failure — a missing footer link must never block a security email.
 */
export async function preferencesUrlFor(admin: Admin, userId: string, appUrl: string): Promise<string | undefined> {
  const { data, error } = await admin.rpc('email_unsubscribe_token', { uid: userId })
  if (error !== null || data === null || data === undefined) return undefined
  return `${appUrl.replace(/\/+$/, '')}/settings?prefs=${encodeURIComponent(String(data))}`
}
