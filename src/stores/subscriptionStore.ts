import { create } from 'zustand'
import type { PlanTier } from '@/constants/plan'
import { subscriptionRepository } from '@/repositories/SubscriptionRepository'
import { UnauthenticatedError } from '@/repositories/errors'

interface SubscriptionState {
  /** Current plan tier. Defaults to 'free' until hydrated from Supabase. */
  tier: PlanTier
  _fetchFromSupabase: () => Promise<void>
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
  reset: () => set({ tier: 'free' }),
}))
