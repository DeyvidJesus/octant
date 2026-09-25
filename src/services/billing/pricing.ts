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

/** Live Pro price from Stripe so it is never hardcoded. Needs a session; null on any failure. */
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

/** e.g. 2900 brl monthly -> "R$ 29.00/month", formatted in the browser locale. */
export function formatPlanPricing(pricing: PlanPricing): string {
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: pricing.currency.toUpperCase(),
  }).format(pricing.amount / 100)

  const suffix: Record<NonNullable<PlanPricing['interval']>, string> = {
    day: '/day',
    week: '/week',
    month: '/month',
    year: '/year',
  }
  return pricing.interval ? `${money}${suffix[pricing.interval]}` : money
}
