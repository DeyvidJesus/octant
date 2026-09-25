import { create } from 'zustand'
import type { PlanTier } from '@/constants/plan'
import { subscriptionRepository } from '@/repositories/SubscriptionRepository'
import { UnauthenticatedError } from '@/repositories/errors'

interface SubscriptionState {
  /** Current plan tier. Defaults to 'free' until hydrated from Supabase. */
  tier: PlanTier
  _fetchFromSupabase: () => Promise<void>
  /** Polls the tier until 'pro' after Checkout; the webhook lags the redirect and tiers are not realtime. */
  refreshUntilPro: (options?: { attempts?: number; intervalMs?: number; signal?: AbortSignal }) => Promise<boolean>
  /** Subscribes to tier changes (upgrade, cancellation in the portal); returns an unsubscribe. */
  _subscribeRealtime: () => () => void
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
  _subscribeRealtime: () => subscriptionRepository.subscribeToTier((tier) => set({ tier })),
  reset: () => set({ tier: 'free' }),
}))
