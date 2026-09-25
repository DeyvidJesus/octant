// Email wiring for Edge Functions; the logic lives in `@octant/email` (packages/email/src), an esbuild alias
// resolved when scripts/bundle-functions.mjs inlines this file into each function's index.ts.

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

/** EmailService cached per isolate. Without RESEND_API_KEY, sends are no-ops. */
export function getEmailService(): EmailService {
  if (cached !== null) return cached
  const { config, warnings } = loadEmailConfig((key) => Deno.env.get(key))
  cached = createEmailService({ config, warnings })
  return cached
}

export interface SendLoggedInput<N extends TemplateName> {
  template: N
  to: string
  props: TemplateDefinitions[N]
  /** Owner of the message, when known. Also part of the dedupe key. */
  userId?: string
  /** Distinguishes separate sends of the same template to the same person. */
  dedupeKey?: string
  preferencesUrl?: string
  /** Extra context for the log row, such as the Stripe event id. */
  metadata?: Record<string, unknown>
}

export type SendLoggedOutcome =
  | { status: 'sent'; id: string | null }
  /** An identical send already happened or is in flight; treat as success. */
  | { status: 'deduped' }
  /** Email isn't configured in this environment. */
  | { status: 'skipped' }
  | { status: 'failed'; code: string; message: string }

// Claims an email_log row (the unique idempotency_key acts as a lock), then sends and records the result.
// Never throws: callers are webhooks, and a 5xx would redeliver an event whose DB work already succeeded.
export async function sendLogged<N extends TemplateName>(
  admin: Admin,
  input: SendLoggedInput<N>,
): Promise<SendLoggedOutcome> {
  const options = {
    userId: input.userId,
    dedupeKey: input.dedupeKey,
    preferencesUrl: input.preferencesUrl,
  }

  // Inside the try: config loading and subject builders can throw.
  let mailer: EmailService
  let idempotencyKey: string
  let subject: string
  try {
    mailer = getEmailService()
    idempotencyKey = mailer.buildIdempotencyKey(input.template, input.to, options)
    subject = mailer.subjectFor(input.template, input.props, options)
  } catch (error) {
    const described = describeEmailError(error)
    console.error(`[email] could not prepare ${input.template}: ${described.code} ${described.message}`)
    return { status: 'failed', ...described }
  }

  // Blank becomes NULL, since '' would fail uuid conversion.
  const ownerId = input.userId === undefined || input.userId.trim() === '' ? null : input.userId

  const claimRow = {
    user_id: ownerId,
    to_email: input.to,
    template: input.template,
    subject,
    status: 'queued',
    idempotency_key: idempotencyKey,
    metadata: input.metadata ?? {},
  }

  let { error: claimError } = await admin.from('email_log').insert(claimRow)

  // 23503: during signup the auth hook runs inside GoTrue's uncommitted transaction, so the user row isn't
  // visible yet. Retry without the link (migration 0015 drops the FK).
  if (claimError !== null && claimError.code === '23503' && ownerId !== null) {
    console.warn(
      `[email] user ${ownerId} not visible yet (uncommitted signup?); logging ${input.template} without the association. ` +
        'Apply migration 0015 to drop the email_log.user_id foreign key.',
    )
    const retry = await admin.from('email_log').insert({ ...claimRow, user_id: null })
    claimError = retry.error
  }

  if (claimError !== null) {
    // 23505: unique violation on idempotency_key, so this email was already handled.
    if (claimError.code === '23505') {
      console.info(`[email] deduped ${input.template} for ${input.to}`)
      return { status: 'deduped' }
    }
    // Any other DB failure means a double-send can't be ruled out, so don't send.
    console.error(
      `[email] could not claim ${input.template}: [${claimError.code ?? 'no-code'}] ${claimError.message}` +
        (claimError.details === undefined || claimError.details === null ? '' : ` — ${claimError.details}`),
    )
    // The Postgres code goes in `code` for visibility; callers must not surface `message` to end users.
    return {
      status: 'failed',
      code: `EMAIL_LOG_CLAIM${claimError.code === undefined ? '' : `_${claimError.code}`}`,
      message: claimError.message,
    }
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

/** Footer preferences link for a user; `undefined` on failure so it never blocks a security email. */
export async function preferencesUrlFor(admin: Admin, userId: string, appUrl: string): Promise<string | undefined> {
  const { data, error } = await admin.rpc('email_unsubscribe_token', { uid: userId })
  if (error !== null || data === null || data === undefined) return undefined
  return `${appUrl.replace(/\/+$/, '')}/settings?prefs=${encodeURIComponent(String(data))}`
}
