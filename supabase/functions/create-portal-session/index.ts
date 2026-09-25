// Supabase Edge Function: create-portal-session
//
// Opens the Stripe Customer Portal so a Pro user can manage/cancel their subscription, update their
// card, and see invoices — from a button on our own site. We look up the user's stripe_customer_id
// (written by the stripe-webhook), create a portal session, and return its URL for the browser to
// redirect to. The Stripe secret key stays server-side.
//
// Deploy:  supabase functions deploy create-portal-session
// Secrets: STRIPE_SECRET_KEY, APP_URL (already set for create-checkout-session).
// Also enable the Customer Portal once in the Stripe Dashboard (Settings → Billing → Customer portal).
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

  // RLS on `subscriptions` is SELECT-only for the owner, so this reads just the caller's own row.
  const { data: row, error: dbError } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (dbError) return json({ error: `Could not load your subscription. ${dbError.message}` }, 500)
  const customerId = row?.stripe_customer_id as string | undefined
  if (!customerId) return json({ error: 'No active subscription to manage.' }, 404)

  const appUrl = Deno.env.get('APP_URL') ?? ''

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/settings`,
    })
    return json({ url: session.url })
  } catch (err) {
    return json({ error: `Could not open the billing portal. ${String(err)}`.trim() }, 502)
  }
})
