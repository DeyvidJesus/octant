// Supabase Edge Function: create-checkout-session
//
// Phase 11 — creates a Stripe Checkout Session for the Pro subscription. The Stripe secret key stays
// server-side; the frontend just redirects to the returned URL. The signed-in user's id is attached
// to the subscription's metadata so the webhook can map the resulting subscription back to the user.
//
// Deploy:  supabase functions deploy create-checkout-session
// Secrets: supabase secrets set STRIPE_SECRET_KEY=sk_... STRIPE_PRICE_ID=price_... APP_URL=https://app...
// (SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically. JWT verification stays ON.)

import Stripe from 'npm:stripe@16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req: Request): Promise<Response> => {
  // Per request, not module-level: a fixed header can only ever serve one origin.
  const CORS_HEADERS = corsHeaders(req)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // Verify the caller's Supabase JWT.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization header.' }, 401)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Invalid or expired session.' }, 401)

  const priceId = Deno.env.get('STRIPE_PRICE_ID')
  if (!priceId) return json({ error: 'Server is missing STRIPE_PRICE_ID.' }, 500)
  const appUrl = Deno.env.get('APP_URL') ?? ''

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      // Stamp the user id onto the SUBSCRIPTION so subscription.* webhook events carry it.
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${appUrl}/settings?checkout=success`,
      cancel_url: `${appUrl}/settings?checkout=cancelled`,
    })
    return json({ url: session.url })
  } catch (err) {
    return json({ error: `Could not start checkout. ${String(err)}`.trim() }, 502)
  }
})
