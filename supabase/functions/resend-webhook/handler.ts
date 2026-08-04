// Supabase Edge Function: resend-webhook
//
// Phase 15 — closes the delivery loop. Resend reports what actually happened to each message AFTER the
// API accepted it, which is the only way to distinguish "we sent it" from "they received it". Without
// this, `email_log.status` would sit at 'sent' forever and a silently bouncing address would never
// surface.
//
// Two jobs:
//   1. Advance `email_log.status` for the matching `provider_message_id`.
//   2. On a hard bounce or a spam complaint, add the address to Resend's own suppression list. This is
//      the part that protects the sending domain: continuing to mail an address that bounced is what
//      turns a good sender reputation into a bad one, and reputation damage affects EVERY user's
//      password resets, not just this one.
//
// Suppression is stored in Resend rather than a local table on purpose — one source of truth, and the
// provider already enforces it at send time.
//
// Source of truth: edit `handler.ts`, then run `yarn build:functions` to regenerate `index.ts`.
//
// Deploy:  yarn build:functions && supabase functions deploy resend-webhook --no-verify-jwt
//          (Resend sends a Svix/Standard-Webhooks signature, not a Supabase JWT.)
// Secrets: supabase secrets set RESEND_WEBHOOK_SECRET=whsec_... RESEND_API_KEY=re_...

import { createResendSuppressions, createResendWebhookVerifier } from '@octant/email'
import { createAdminClient } from '../_shared/admin.ts'

/**
 * Resend event type → the `email_log.status` it implies.
 *
 * Only terminal-ish transitions are mapped. `email.opened` / `email.clicked` are deliberately ignored:
 * they require tracking pixels, say nothing about deliverability, and recording them on transactional
 * mail is needless surveillance of people reading their own password resets.
 */
const STATUS_BY_EVENT: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
}

/** Events after which we must stop mailing the address entirely. */
const SUPPRESSING_EVENTS = new Set(['email.bounced', 'email.complained'])

/**
 * Ordering guard. Webhook deliveries can arrive out of order, so a late `email.sent` must not overwrite
 * an already-recorded `delivered` or `bounced`. Higher wins.
 */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  skipped: 1,
  sent: 2,
  delivered: 3,
  failed: 4,
  suppressed: 5,
  complained: 6,
  bounced: 7,
}

interface ResendWebhookEvent {
  type?: string
  data?: {
    email_id?: string
    to?: string | string[]
    // Present on bounce events; `hard` is permanent, `soft`/`transient` are not.
    bounce?: { type?: string; subType?: string }
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function firstRecipient(to: string | string[] | undefined): string | undefined {
  if (to === undefined) return undefined
  const value = Array.isArray(to) ? to[0] : to
  return value !== undefined && value.trim() !== '' ? value.trim() : undefined
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (apiKey === undefined || webhookSecret === undefined) {
    console.error('[resend-webhook] RESEND_API_KEY or RESEND_WEBHOOK_SECRET is not set.')
    return json({ error: 'Webhook is not configured.' }, 500)
  }

  const body = await req.text()

  // Verified through the package's verifier port, which wraps the Resend SDK's own Standard Webhooks
  // implementation — no hand-rolled HMAC comparison, and the SDK stays confined to `ResendTransport.ts`.
  let event: ResendWebhookEvent
  try {
    const verifier = createResendWebhookVerifier({ apiKey })
    event = verifier.verify({ payload: body, headers: req.headers, webhookSecret }) as ResendWebhookEvent
  } catch (err) {
    console.error(`[resend-webhook] signature verification failed: ${String(err)}`)
    return json({ error: 'Invalid webhook signature.' }, 401)
  }

  const eventType = event.type ?? ''
  const nextStatus = STATUS_BY_EVENT[eventType]
  if (nextStatus === undefined) {
    // Ack so Resend stops retrying an event we intentionally ignore.
    return json({ received: true, ignored: eventType })
  }

  const messageId = event.data?.email_id
  const recipient = firstRecipient(event.data?.to)

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    // 500 so Resend redelivers once the credential is set — otherwise the delivery status is lost.
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[resend-webhook] ${detail}`)
    return json({ error: detail }, 500)
  }

  if (messageId !== undefined) {
    const { data: existing } = await admin
      .from('email_log')
      .select('id, status')
      .eq('provider_message_id', messageId)
      .maybeSingle()

    if (existing === null || existing === undefined) {
      // A message we have no record of — most likely sent from the Resend dashboard, or from an
      // environment pointed at the same API key. Not an error.
      console.info(`[resend-webhook] no email_log row for message ${messageId} (${eventType})`)
    } else if ((STATUS_RANK[nextStatus] ?? 0) <= (STATUS_RANK[existing.status] ?? 0)) {
      // Out-of-order delivery: a later-arriving weaker event must not regress the recorded status.
      console.info(`[resend-webhook] ignoring ${eventType}; ${existing.status} already recorded`)
    } else {
      const { error } = await admin
        .from('email_log')
        .update({
          status: nextStatus,
          error_code: SUPPRESSING_EVENTS.has(eventType) ? eventType : null,
          error_message: event.data?.bounce?.subType ?? null,
        })
        .eq('id', existing.id)
      if (error !== null) console.error(`[resend-webhook] could not update email_log: ${error.message}`)
    }
  }

  // Suppress only on a hard bounce or a complaint. A soft bounce is a full mailbox or a transient
  // server error — suppressing on those would permanently cut off users over a temporary problem.
  const isHardBounce = eventType === 'email.bounced' && (event.data?.bounce?.type ?? '').toLowerCase() === 'hard'
  const isComplaint = eventType === 'email.complained'
  if ((isHardBounce || isComplaint) && recipient !== undefined) {
    try {
      await createResendSuppressions({ apiKey }).add(recipient)
      console.warn(`[resend-webhook] suppressed ${recipient} after ${eventType}`)
    } catch (err) {
      // Log, don't fail: a retried webhook would repeat the log update too, and the send path already
      // refuses suppressed recipients on the provider side.
      console.error(`[resend-webhook] could not suppress ${recipient}: ${String(err)}`)
    }
  }

  return json({ received: true, type: eventType, status: nextStatus })
})
