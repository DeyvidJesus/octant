import { supabase } from '@/services/supabase/client'

/** Same-project Edge Function that creates a Stripe Customer Portal session server-side. */
const PORTAL_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-portal-session`

/**
 * Opens the Stripe Customer Portal so a Pro user can manage or cancel their subscription, update
 * their card, and see invoices. Asks the Edge Function for a portal session (the secret key stays
 * server-side) and redirects the browser to it. Requires an authenticated session with an active
 * subscription.
 */
export async function openBillingPortal(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('You must be signed in to manage your subscription.')

  const response = await fetch(PORTAL_URL, {
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
    throw new Error(`Could not open the billing portal. ${detail}`.trim())
  }

  const { url } = (await response.json()) as { url?: string }
  if (!url) throw new Error('Billing portal session did not return a URL.')
  window.location.href = url
}
