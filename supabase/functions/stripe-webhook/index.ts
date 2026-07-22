// Supabase Edge Function: stripe-webhook
//
// Phase 11 — the source of truth for a user's tier. Stripe calls this on subscription lifecycle
// events; we verify the signature, then upsert public.subscriptions with the service-role key
// (bypassing RLS, since clients are never allowed to write their own tier).
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
//          (Stripe does NOT send a Supabase JWT — JWT verification MUST be disabled for this one.)
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_WEBHOOK_SECRET=whsec_...
//          SUPABASE_SERVICE_ROLE_KEY is injected automatically.
// Register the endpoint in Stripe for: customer.subscription.created, .updated, .deleted.

import Stripe from 'npm:stripe@16'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})
// Web Crypto-based signature verification (Node's sync crypto isn't available in the Deno isolate).
const cryptoProvider = Stripe.createSubtleCryptoProvider()

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

  const relevant = new Set([
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
  ])
  if (!relevant.has(event.type)) {
    return new Response(JSON.stringify({ received: true, ignored: event.type }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const subscription = event.data.object as Stripe.Subscription
  const userId = subscription.metadata?.user_id
  if (!userId) {
    // Nothing to map to; ack so Stripe doesn't retry forever, but flag it.
    return new Response(JSON.stringify({ received: true, warning: 'no user_id in metadata' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  const isActive =
    event.type !== 'customer.subscription.deleted' &&
    (subscription.status === 'active' || subscription.status === 'trialing')

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

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

  if (error) return new Response(`Database error: ${error.message}`, { status: 500 })
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
})
