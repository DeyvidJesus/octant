import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type { PlanTier } from '@/constants/plan'
import { supabase } from '@/services/supabase/client'
import { getSessionUserId } from '@/services/supabase/session'
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

  /** Pushes tier changes written by the Stripe webhook (subscriptions is on the realtime publication). */
  subscribeToTier(onTier: (tier: PlanTier) => void): () => void {
    const userId = getSessionUserId()
    if (!userId) return () => {}
    const channel = supabase
      .channel(`subscriptions:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<SubscriptionRow>) => {
          const tier = payload.eventType === 'DELETE' ? 'free' : payload.new?.tier
          if (tier === 'free' || tier === 'pro') onTier(tier)
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }
}

/** Shared singleton for stores; the class is exported for tests. */
export const subscriptionRepository = new SubscriptionRepository()
