import type { PlanTier } from '@/constants/plan'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'

interface SubscriptionRow {
  tier: PlanTier
}

/**
 * Read-only access to the current user's subscription tier. Writes happen only server-side in the
 * Stripe webhook (service role); clients can never change their own tier.
 */
export class SubscriptionRepository extends BaseRepository {
  /** The user's tier, defaulting to 'free' when no subscription row exists. */
  async getTier(): Promise<PlanTier> {
    const userId = this.requireUserId()
    const row = this.unwrap(
      await supabase.from('subscriptions').select('tier').eq('user_id', userId).maybeSingle(),
      'load your subscription',
    ) as SubscriptionRow | null
    return row?.tier ?? 'free'
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const subscriptionRepository = new SubscriptionRepository()
