// stripe-webhook: verifies the signature, upserts the user's tier, and sends billing emails.
// Deploy with --no-verify-jwt; `yarn build:functions` regenerates index.ts.

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
// Web Crypto verification, since Node's sync crypto isn't available in Deno.
const cryptoProvider = Stripe.createSubtleCryptoProvider()

// deno-lint-ignore no-explicit-any
type Admin = any

/** Events that change a user's tier. */
const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

/** Tier events plus email-only events. */
const HANDLED_EVENTS = new Set<string>([...SUBSCRIPTION_EVENTS, ...BILLING_EVENT_TYPES])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

// Mirrors the subscription (`pro` while active or trialing, else `free`) unless a newer event already
// applied (migration 0018). Returns the DB error, or `stale` when this event was older.
async function upsertSubscription(
  admin: Admin,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
  userId: string,
): Promise<{ error: string | null; stale: boolean }> {
  const isActive =
    event.type !== 'customer.subscription.deleted' &&
    (subscription.status === 'active' || subscription.status === 'trialing')

  const { data: applied, error } = await admin.rpc('apply_subscription_event', {
    p_user_id: userId,
    p_tier: isActive ? 'pro' : 'free',
    p_status: subscription.status,
    p_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    p_subscription_id: subscription.id,
    p_current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    p_event_created: new Date(event.created * 1000).toISOString(),
  })
  if (error !== null) return { error: error.message, stale: false }
  return { error: null, stale: applied === false }
}

// Subscription events carry user_id in metadata; for invoice events the subscription is fetched to read it.
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

/** Email and display name from auth, since `subscriptions` has no email column. */
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
    // Ack so Stripe doesn't retry forever, but flag it.
    return json({ received: true, warning: 'no user_id in subscription metadata' })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    // 500 so Stripe redelivers once the credential is configured; the tier can't be written without it.
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[stripe-webhook] ${detail}`)
    return new Response(detail, { status: 500 })
  }

  // A DB error returns 5xx so Stripe retries the tier update.
  if (SUBSCRIPTION_EVENTS.has(event.type) && subscription !== undefined) {
    const { error: dbError, stale } = await upsertSubscription(admin, event, subscription, userId)
    if (dbError !== null) return new Response(`Database error: ${dbError}`, { status: 500 })
    // A late delivery must not email about a state the subscription has already left.
    if (stale) return json({ received: true, applied: false, reason: 'older than the last applied event' })
  }

  // Email is best-effort and never causes a 5xx, which would redeliver an already-applied tier update.
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

  // Most `.updated` events (renewals, metadata changes) intentionally send nothing.
  if (mapped === null) {
    return json({ received: true, emailed: false, reason: 'no email for this event' })
  }

  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')
  const outcome = await sendLogged(admin, {
    template: mapped.template,
    to: email,
    props: mapped.props,
    userId,
    // Keyed to the Stripe object so a redelivery can't send twice.
    dedupeKey: mapped.dedupeKey,
    preferencesUrl: await preferencesUrlFor(admin, userId, appUrl),
    metadata: { source: 'stripe-webhook', stripe_event_id: event.id, stripe_event_type: event.type },
  })

  // Always 200 here: the tier is already correct.
  return json({ received: true, emailed: outcome.status, template: mapped.template })
})
