import { useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase/client'
import { setSessionUserId } from '@/services/supabase/session'
import { identifyUser, resetAnalytics } from '@/services/analytics/analytics'
import { setSentryUser } from '@/services/monitoring/sentry'
import { sendWelcomeEmail } from '@/services/email/notifications'
import { useJobsStore } from '@/stores/jobsStore'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useInterviewPrepStore } from '@/stores/interviewPrepStore'
import { useGeneratorStore } from '@/stores/generatorStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { useSubscriptionStore } from '@/stores/subscriptionStore'
import { useSearchProfileStore } from '@/stores/searchProfileStore'
import { resetAllStores } from '@/stores/reset'
import { AuthContext, type AuthContextValue } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Torn down before every resubscribe so token refreshes never leak duplicate channels.
    let realtimeCleanups: Array<() => void> = []
    const teardownRealtime = () => {
      realtimeCleanups.forEach((cleanup) => cleanup())
      realtimeCleanups = []
    }

    // Hydrated user id (undefined = not yet). Keyed on user, not token, so refreshes and the duplicate
    // INITIAL_SESSION event don't re-hydrate; set before any await to win that race.
    let currentUserId: string | null | undefined = undefined
    let disposed = false

    const syncData = async (session: Session | null) => {
      const nextUserId = session?.user?.id ?? null
      // Must run before any repository call, which reads the user id from this mirror.
      setSessionUserId(nextUserId)
      setSession(session)
      setUser(session?.user ?? null)
      // Attach observability identity (no-ops when analytics/Sentry aren't configured).
      if (session?.user) {
        identifyUser(session.user.id)
        setSentryUser(session.user.id)
      } else {
        resetAnalytics()
        setSentryUser(null)
      }

      // Only (re)hydrate when the user actually changes — skip token refreshes and duplicate events.
      if (nextUserId === currentUserId) {
        setIsLoading(false)
        return
      }
      currentUserId = nextUserId

      // Welcome email has no server trigger, so the client requests it; `send-email` dedupes via
      // `email_log.idempotency_key`. Fire-and-forget so it never blocks hydration.
      if (session?.user?.email_confirmed_at != null) {
        void sendWelcomeEmail()
      }

      teardownRealtime()
      // Wipe the previous user's data on sign-out and on user switch.
      resetAllStores()

      if (nextUserId) {
        await Promise.all([
          useJobsStore.getState()._fetchFromSupabase?.(),
          useApplicationsStore.getState()._fetchFromSupabase?.(),
          useSettingsStore.getState()._fetchFromSupabase?.(),
          useResumeStore.getState()._fetchFromSupabase?.(),
          useInterviewPrepStore.getState()._fetchFromSupabase?.(),
          useGeneratorStore.getState()._fetchFromSupabase?.(),
          useDiscoveryStore.getState()._fetchFromSupabase?.(),
          useSubscriptionStore.getState()._fetchFromSupabase?.(),
          useSearchProfileStore.getState()._fetchFromSupabase?.(),
        ])
        // Bail if the effect was torn down or the user changed during the fetches, or a stale run
        // would subscribe duplicate channels (or the previous user's).
        if (disposed || currentUserId !== nextUserId) return
        // Subscribe after the initial load so realtime deltas apply on top of a hydrated store.
        realtimeCleanups = [
          useJobsStore.getState()._subscribeRealtime(),
          useApplicationsStore.getState()._subscribeRealtime(),
          useDiscoveryStore.getState()._subscribeRealtime(),
        ]
      }
      setIsLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncData(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncData(session)
    })

    return () => {
      disposed = true
      subscription.unsubscribe()
      teardownRealtime()
    }
  }, [])

  // Stable identity so consumers only re-render when auth state actually changes.
  const value = useMemo<AuthContextValue>(() => ({ session, user, isLoading }), [session, user, isLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
