import { create } from 'zustand'
import type { PlanTier } from '@/constants/plan'
import { subscriptionRepository } from '@/repositories/SubscriptionRepository'
import { UnauthenticatedError } from '@/repositories/errors'

interface SubscriptionState {
  /** Current plan tier. Defaults to 'free' until hydrated from Supabase. */
  tier: PlanTier
  _fetchFromSupabase: () => Promise<void>
  /**
   * Re-reads the tier until it is 'pro' or the attempts run out; resolves whether it got there. Used after
   * Stripe Checkout returns: the tier is written by the webhook, which usually lands a few seconds after
   * the redirect, and `subscriptions` is not on the realtime publication.
   */
  refreshUntilPro: (options?: { attempts?: number; intervalMs?: number; signal?: AbortSignal }) => Promise<boolean>
  /** Clears in-memory state (sign-out / user switch) so no data bleeds across sessions. */
  reset: () => void
}

export const useSubscriptionStore = create<SubscriptionState>()((set) => ({
  tier: 'free',
  _fetchFromSupabase: async () => {
    try {
      set({ tier: await subscriptionRepository.getTier() })
    } catch (error) {
      if (error instanceof UnauthenticatedError) return
      console.error('[subscriptionStore] failed to load subscription', error)
    }
  },
  refreshUntilPro: async ({ attempts = 10, intervalMs = 2000, signal } = {}) => {
    for (let attempt = 0; attempt < attempts && !signal?.aborted; attempt++) {
      try {
        const tier = await subscriptionRepository.getTier()
        if (signal?.aborted) return false
        set({ tier })
        if (tier === 'pro') return true
      } catch (error) {
        if (error instanceof UnauthenticatedError) return false
        console.error('[subscriptionStore] failed to refresh subscription', error)
      }
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    return false
  },
  reset: () => set({ tier: 'free' }),
}))
