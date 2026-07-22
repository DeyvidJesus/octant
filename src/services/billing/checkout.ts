import { supabase } from '@/services/supabase/client'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'

/** Same-project Edge Function that creates the Stripe Checkout Session server-side. */
const CHECKOUT_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-checkout-session`

/**
 * Starts the Pro upgrade flow: asks the Edge Function for a Stripe Checkout Session (the secret key
 * stays server-side) and redirects the browser to it. Requires an authenticated session.
 */
export async function startProCheckout(): Promise<void> {
  trackEvent(AnalyticsEvent.UpgradeStarted)

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('You must be signed in to upgrade.')

  const response = await fetch(CHECKOUT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    let detail = ''
    try {
      detail = ((await response.json()) as { error?: string })?.error ?? ''
    } catch {
      // keep the status-only message
    }
    throw new Error(`Could not start checkout. ${detail}`.trim())
  }

  const { url } = (await response.json()) as { url?: string }
  if (!url) throw new Error('Checkout session did not return a URL.')
  window.location.href = url
}
