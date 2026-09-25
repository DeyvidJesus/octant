// resend-webhook: verifies Resend's signature, advances email_log.status, and suppresses hard bounces and
// complaints in Resend. Deploy with --no-verify-jwt; `yarn build:functions` regenerates index.ts.

import { createResendSuppressions, createResendWebhookVerifier } from '@octant/email'
import { createAdminClient } from '../_shared/admin.ts'

// Resend event type to email_log.status. Opens and clicks are ignored on purpose (no tracking).
const STATUS_BY_EVENT: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
  'email.suppressed': 'suppressed',
}

/** Events after which the address must not be mailed again. */
const SUPPRESSING_EVENTS = new Set(['email.bounced', 'email.complained'])

/** Deliveries can arrive out of order; a status only replaces a lower-ranked one. */
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

  // Uses the Resend SDK's Standard Webhooks verifier, wrapped by @octant/email.
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
    // Ack ignored events so Resend stops retrying them.
    return json({ received: true, ignored: eventType })
  }

  const messageId = event.data?.email_id
  const recipient = firstRecipient(event.data?.to)

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    // 500 so Resend redelivers once the credential is set, instead of losing the status.
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
      // Unknown message, e.g. sent from the Resend dashboard or another environment. Not an error.
      console.info(`[resend-webhook] no email_log row for message ${messageId} (${eventType})`)
    } else if ((STATUS_RANK[nextStatus] ?? 0) <= (STATUS_RANK[existing.status] ?? 0)) {
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

  // Soft bounces are temporary, so only hard bounces and complaints suppress the address.
  const isHardBounce = eventType === 'email.bounced' && (event.data?.bounce?.type ?? '').toLowerCase() === 'hard'
  const isComplaint = eventType === 'email.complained'
  if ((isHardBounce || isComplaint) && recipient !== undefined) {
    try {
      await createResendSuppressions({ apiKey }).add(recipient)
      console.warn(`[resend-webhook] suppressed ${recipient} after ${eventType}`)
    } catch (err) {
      // Log, don't fail: a retry would redo the log update, and Resend already blocks bounced addresses.
      console.error(`[resend-webhook] could not suppress ${recipient}: ${String(err)}`)
    }
  }

  return json({ received: true, type: eventType, status: nextStatus })
})
