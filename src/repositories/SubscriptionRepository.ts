import type { PlanTier } from '@/constants/plan'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'

interface SubscriptionRow {
  tier: PlanTier
}

/** Read-only tier access; only the Stripe webhook (service role) can write it. */
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

/** Shared singleton for stores; the class is exported for tests. */
export const subscriptionRepository = new SubscriptionRepository()
