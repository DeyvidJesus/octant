import { supabase } from '@/services/supabase/client'

/** Same-project Edge Function that creates a Stripe Customer Portal session server-side. */
const PORTAL_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/create-portal-session`

/** Redirects to the Stripe Customer Portal. Needs a session and an active subscription. */
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
