// Supabase Edge Function: stripe-webhook
//
// Phase 11 — the source of truth for a user's tier. Phase 15 extends it to send the billing emails.
//
// Stripe calls this on subscription and invoice events; we verify the signature, upsert
// public.subscriptions with the service-role key (clients are never allowed to write their own tier),
// and then send whichever email the event implies.
//
// TWO RULES worth understanding before editing:
//
//  1. The database upsert is the contract; the email is best-effort. An email failure must NEVER make
//     this function return 5xx, because Stripe would then redeliver an event whose tier update already
//     succeeded. Every send goes through `sendLogged`, which swallows failures into a return value and
//     records them in `email_log` instead.
//
//  2. Which email an event implies is decided by `mapBillingEmail` in `@octant/email` — a pure function
//     with unit tests. `supabase/functions/**` is outside the vitest suite, so mapping logic left here
//     would be untested. This file only orchestrates.
//
// Events REQUIRED on the Stripe endpoint (see BILLING_EVENT_TYPES, which the tests assert):
//   customer.subscription.created / .updated / .deleted / .trial_will_end
//   invoice.payment_succeeded / invoice.payment_failed
//
// Source of truth: edit `handler.ts`, then run `yarn build:functions` to regenerate `index.ts`.
//
// Deploy:  yarn build:functions && supabase functions deploy stripe-webhook --no-verify-jwt
//          (Stripe does NOT send a Supabase JWT — JWT verification MUST be disabled for this one.)
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
//          plus the shared email secrets (RESEND_API_KEY, EMAIL_FROM, APP_URL).
//          SUPABASE_SERVICE_ROLE_KEY is injected automatically.

import Stripe from 'npm:stripe@16'
import {
  BILLING_EVENT_TYPES,
  displayNameFrom,
  mapBillingEmail,
  userIdFromSubscription,
  type StripeEventLike,
} from '@octant/email'
import { createAdminClient } from '../_shared/admin.ts'
import { preferencesUrlFor, sendLogged } from '../_shared/mailer.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
// Web Crypto-based signature verification (Node's sync crypto isn't available in the Deno isolate).
const cryptoProvider = Stripe.createSubtleCryptoProvider()

// deno-lint-ignore no-explicit-any
type Admin = any

/** Events that change a user's tier and therefore require the subscriptions upsert. */
const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

/** Every event this function acts on: the tier-affecting ones plus the email-only ones. */
const HANDLED_EVENTS = new Set<string>([...SUBSCRIPTION_EVENTS, ...BILLING_EVENT_TYPES])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

/**
 * Mirrors the subscription into `public.subscriptions`. Unchanged behaviour from Phase 11: `pro` while
 * active or trialing, `free` otherwise.
 */
async function upsertSubscription(
  admin: Admin,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  userId: string,
): Promise<string | null> {
  const isActive =
    event.type !== 'customer.subscription.deleted' &&
    (subscription.status === 'active' || subscription.status === 'trialing')

  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      tier: isActive ? 'pro' : 'free',
      status: subscription.status,
      stripe_customer_id:
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      current_period_end: subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  return error === null ? null : error.message
}

/**
 * Resolves the user id an event belongs to.
 *
 * Subscription events carry it in metadata (stamped by create-checkout-session). Invoice events don't,
 * so we retrieve the subscription to read it — one extra API call, on a path that runs at most a few
 * times per user per month.
 */
async function resolveUserId(event: Stripe.Event): Promise<{ userId?: string; subscription?: Stripe.Subscription }> {
  if (SUBSCRIPTION_EVENTS.has(event.type) || event.type === 'customer.subscription.trial_will_end') {
    const subscription = event.data.object as Stripe.Subscription
    return { userId: userIdFromSubscription(subscription), subscription }
  }

  const invoice = event.data.object as Stripe.Invoice
  const subscriptionRef = invoice.subscription
  const subscriptionId = typeof subscriptionRef === 'string' ? subscriptionRef : subscriptionRef?.id
  if (subscriptionId === undefined || subscriptionId === null) return {}

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return { userId: userIdFromSubscription(subscription), subscription }
  } catch (err) {
    console.error(`[stripe-webhook] could not retrieve subscription ${subscriptionId}: ${String(err)}`)
    return {}
  }
}

/** Reads the account's email and display name straight from auth — `subscriptions` has no email column. */
async function resolveRecipient(
  admin: Admin,
  userId: string,
): Promise<{ email?: string; name?: string }> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error !== null || data?.user === null || data?.user === undefined) {
    console.error(`[stripe-webhook] could not load user ${userId}: ${error?.message ?? 'not found'}`)
    return {}
  }
  return {
    email: data.user.email ?? undefined,
    name: displayNameFrom(data.user.user_metadata as Record<string, unknown> | null),
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return new Response('Method not allowed.', { status: 405 })

  const signature = req.headers.get('stripe-signature')
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!signature || !secret) return new Response('Missing signature or webhook secret.', { status: 400 })

  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider)
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${String(err)}`, { status: 400 })
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return json({ received: true, ignored: event.type })
  }

  const { userId, subscription } = await resolveUserId(event)
  if (userId === undefined) {
    // Nothing to map to; ack so Stripe doesn't retry forever, but flag it.
    return json({ received: true, warning: 'no user_id in subscription metadata' })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    // 500 is correct here: without the admin client the tier cannot be written, and Stripe SHOULD
    // redeliver once the credential is configured.
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[stripe-webhook] ${detail}`)
    return new Response(detail, { status: 500 })
  }

  // ── 1. Tier update: the part Stripe is allowed to retry us for ─────────────────────────────────
  if (SUBSCRIPTION_EVENTS.has(event.type) && subscription !== undefined) {
    const dbError = await upsertSubscription(admin, event, subscription, userId)
    if (dbError !== null) return new Response(`Database error: ${dbError}`, { status: 500 })
  }

  // ── 2. Email: best-effort, never a reason to 5xx ────────────────────────────────────────────────
  const { email, name } = await resolveRecipient(admin, userId)
  if (email === undefined) {
    return json({ received: true, warning: 'user has no email address' })
  }

  const mapped = mapBillingEmail(event as unknown as StripeEventLike, {
    nowUnixSeconds: Math.floor(Date.now() / 1000),
    name,
    defaultPlanName: Deno.env.get('BILLING_PLAN_NAME') ?? 'Pro',
    gracePeriodDays: Number(Deno.env.get('BILLING_GRACE_PERIOD_DAYS') ?? '7'),
    locale: Deno.env.get('EMAIL_LOCALE') ?? undefined,
  })

  // Most `.updated` events map to nothing on purpose — a renewal or a metadata tweak is not news.
  if (mapped === null) {
    return json({ received: true, emailed: false, reason: 'no email for this event' })
  }

  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')
  const outcome = await sendLogged(admin, {
    template: mapped.template,
    to: email,
    props: mapped.props,
    userId,
    // Keyed to the Stripe object, so a webhook redelivery cannot produce a second email.
    dedupeKey: mapped.dedupeKey,
    preferencesUrl: await preferencesUrlFor(admin, userId, appUrl),
    metadata: { source: 'stripe-webhook', stripe_event_id: event.id, stripe_event_type: event.type },
  })

  // Always 200 here: the tier is already correct, and a redelivery would only repeat work.
  return json({ received: true, emailed: outcome.status, template: mapped.template })
})
