// get-plan-pricing: returns the live STRIPE_PRICE_ID amount, currency and interval to a JWT-verified caller.

import Stripe from 'npm:stripe@16'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req: Request): Promise<Response> => {
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

  try {
    const price = await stripe.prices.retrieve(priceId)
    return json({
      // Smallest currency unit (e.g. cents); the client formats it.
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null, // 'month' | 'year' | null
    })
  } catch (err) {
    return json({ error: `Could not load pricing. ${String(err)}`.trim() }, 502)
  }
})
