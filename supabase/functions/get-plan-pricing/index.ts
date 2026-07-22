// Supabase Edge Function: get-plan-pricing
//
// Returns the live Pro price (amount / currency / interval) straight from Stripe, so the site always
// displays exactly what STRIPE_PRICE_ID charges — no hardcoded price to keep in sync. Read-only; the
// Stripe secret key stays server-side. Called from the authenticated Settings page.
//
// Deploy:  supabase functions deploy get-plan-pricing
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID (already set for create-checkout-session).
// (SUPABASE_URL / SUPABASE_ANON_KEY are injected automatically. JWT verification stays ON.)

import Stripe from 'npm:stripe@16'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // Verify the caller's Supabase JWT (the price card only renders for signed-in users).
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

  try {
    const price = await stripe.prices.retrieve(priceId)
    return json({
      // unit_amount is in the currency's smallest unit (e.g. cents); the client formats it.
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null, // 'month' | 'year' | null
    })
  } catch (err) {
    return json({ error: `Could not load pricing. ${String(err)}`.trim() }, 502)
  }
})
