import { supabase } from '@/services/supabase/client'

/** Same-project Edge Function that returns the live Pro price from Stripe. */
const PRICING_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/get-plan-pricing`

export interface PlanPricing {
  /** Amount in the currency's smallest unit (e.g. cents), as Stripe stores it. */
  amount: number
  /** ISO currency code, lowercase (e.g. 'brl', 'usd'). */
  currency: string
  /** Billing interval, or null for a one-off price. */
  interval: 'day' | 'week' | 'month' | 'year' | null
}

/**
 * Fetches the Pro price straight from Stripe (via the Edge Function) so the site never hardcodes it.
 * Requires an authenticated session. Returns null on any failure so the UI can degrade gracefully.
 */
export async function fetchPlanPricing(): Promise<PlanPricing | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return null

  try {
    const response = await fetch(PRICING_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null
    const data = (await response.json()) as Partial<PlanPricing>
    if (typeof data.amount !== 'number' || typeof data.currency !== 'string') return null
    return { amount: data.amount, currency: data.currency, interval: data.interval ?? null }
  } catch {
    return null
  }
}

/** Formats a Stripe price for display, e.g. `{ amount: 2900, currency: 'brl', interval: 'month' }` → "R$ 29,00/mês". */
export function formatPlanPricing(pricing: PlanPricing): string {
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: pricing.currency.toUpperCase(),
  }).format(pricing.amount / 100)

  const suffix: Record<NonNullable<PlanPricing['interval']>, string> = {
    day: '/dia',
    week: '/semana',
    month: '/mês',
    year: '/ano',
  }
  return pricing.interval ? `${money}${suffix[pricing.interval]}` : money
}
