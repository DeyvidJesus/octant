import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Crown, Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useToastStore } from '@/stores/toastStore'
import { startProCheckout } from '@/services/billing/checkout'
import { openBillingPortal } from '@/services/billing/portal'
import { fetchPlanPricing, formatPlanPricing } from '@/services/billing/pricing'
import { FREE_LIMITS } from '@/constants/plan'

export function PlanCard() {
  const tier = useSubscriptionStore((state) => state.tier)
  const refreshUntilPro = useSubscriptionStore((state) => state.refreshUntilPro)
  const notify = useToastStore((state) => state.notify)
  const [searchParams, setSearchParams] = useSearchParams()
  // Read once: Stripe sends the user back to /settings?checkout=success|cancelled.
  const [checkoutResult] = useState(() => searchParams.get('checkout'))
  const [confirming, setConfirming] = useState(checkoutResult === 'success')
  const [loading, setLoading] = useState(false)
  const [managing, setManaging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [price, setPrice] = useState<string | null>(null)

  // Back from Checkout: wait for the webhook to flip the tier, instead of showing "Free" until a reload.
  useEffect(() => {
    if (checkoutResult === 'cancelled') notify('Checkout cancelled. You are still on the Free plan.', 'info')
    if (checkoutResult !== 'success') return
    const controller = new AbortController()
    void refreshUntilPro({ signal: controller.signal }).then((upgraded) => {
      if (controller.signal.aborted) return
      setConfirming(false)
      notify(
        upgraded
          ? 'Welcome to Pro. Your limits are lifted.'
          : 'Payment received. Your plan will update in a moment; refresh the page if it does not.',
        upgraded ? 'success' : 'info',
      )
    })
    return () => controller.abort()
  }, [checkoutResult, refreshUntilPro, notify])

  // Drop the query param so a reload does not replay the confirmation.
  useEffect(() => {
    if (checkoutResult === null) return
    setSearchParams(
      (params) => {
        params.delete('checkout')
        return params
      },
      { replace: true },
    )
  }, [checkoutResult, setSearchParams])

  // Show the real Stripe price (only needed on the free-tier upgrade card).
  useEffect(() => {
    if (tier === 'pro') return
    let cancelled = false
    fetchPlanPricing().then((pricing) => {
      if (!cancelled && pricing) setPrice(formatPlanPricing(pricing))
    })
    return () => {
      cancelled = true
    }
  }, [tier])

  const upgrade = async () => {
    setLoading(true)
    setError(null)
    try {
      await startProCheckout() // redirects on success
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout.')
      setLoading(false)
    }
  }

  const manage = async () => {
    setManaging(true)
    setError(null)
    try {
      await openBillingPortal() // redirects on success
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the billing portal.')
      setManaging(false)
    }
  }

  return (
    <div className="bg-surface border border-edge rounded-xl p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-ink-strong flex items-center gap-2">
          <Crown size={16} className="text-warning" aria-hidden /> Plan
        </h2>
        <Badge tone={tier === 'pro' ? 'success' : 'info'}>{tier === 'pro' ? 'Pro' : 'Free'}</Badge>
      </div>

      {tier === 'pro' ? (
        <>
          <p className="text-sm text-muted leading-relaxed mb-5">
            You're on <span className="text-ink-2 font-medium">Pro</span> — unlimited opportunities and
            tailored resumes. Manage your subscription, payment method, or cancel anytime.
          </p>
          <Button variant="subtle" onClick={manage} disabled={managing}>
            {managing ? 'Opening…' : 'Manage subscription'}
          </Button>
          {error && <p className="text-xs text-danger/90 leading-relaxed mt-3">{error}</p>}
        </>
      ) : (
        <>
          <p className="text-sm text-muted leading-relaxed mb-4">
            The Free plan includes up to {FREE_LIMITS.jobs} opportunities and{' '}
            {FREE_LIMITS.tailoredResumes} tailored resume. Upgrade to Pro for unlimited access.
          </p>
          {price && (
            <p className="text-2xl font-semibold text-ink-strong mb-4">
              {price}
            </p>
          )}
          <ul className="text-sm text-ink-2 space-y-1.5 mb-5">
            <li className="flex items-center gap-2"><Check size={14} className="text-success" aria-hidden /> Unlimited opportunities</li>
            <li className="flex items-center gap-2"><Check size={14} className="text-success" aria-hidden /> Unlimited tailored resumes</li>
          </ul>
          <Button onClick={upgrade} disabled={loading || confirming}>
            <Crown size={14} aria-hidden />{' '}
            {confirming ? 'Confirming your upgrade…' : loading ? 'Starting checkout…' : 'Upgrade to Pro'}
          </Button>
          {error && <p className="text-xs text-danger/90 leading-relaxed mt-3">{error}</p>}
        </>
      )}
    </div>
  )
}
