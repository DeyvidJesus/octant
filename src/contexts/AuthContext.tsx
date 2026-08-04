import { createContext, useContext, useEffect, useState } from 'react'
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

interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Active realtime unsubscribe handles. Torn down before every (re)subscribe so a token refresh
    // — which re-fires onAuthStateChange — never leaks duplicate channels.
    let realtimeCleanups: Array<() => void> = []
    const teardownRealtime = () => {
      realtimeCleanups.forEach((cleanup) => cleanup())
      realtimeCleanups = []
    }

    // The user id we've already hydrated for. `undefined` = not yet initialized. Keyed on user id
    // (not the access token) so a TOKEN_REFRESHED event for the same user does NOT re-run the eight
    // fetches or re-subscribe — and so both getSession() and onAuthStateChange's INITIAL_SESSION
    // (which fire on load) only hydrate once. Set synchronously before any await to win that race.
    let currentUserId: string | null | undefined = undefined

    const syncData = async (session: Session | null) => {
      const nextUserId = session?.user?.id ?? null
      // Mirror the user id into the module-level session holder BEFORE any repository call, so the
      // repository layer resolves it synchronously (no per-write `auth.getUser()` network round-trip).
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

      // Welcome email. There is no server-side trigger for it: GoTrue's Send Email Hook only fires for
      // outbound AUTH mail, and a database trigger on auth.users would mean putting a service-role
      // secret inside Postgres. So the client nudges it on the first authenticated render after the
      // address is confirmed, and the `send-email` function makes it exactly-once via
      // `email_log.idempotency_key`. Fire-and-forget: it must never delay or block hydration.
      if (session?.user?.email_confirmed_at != null) {
        void sendWelcomeEmail()
      }

      teardownRealtime()
      // Wipe the previous user's in-memory data on every transition (sign-out AND user switch) so
      // nothing bleeds across sessions on a shared browser.
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
        // Subscribe after the initial load so realtime deltas apply on top of a hydrated store.
        realtimeCleanups = [
          useJobsStore.getState()._subscribeRealtime(),
          useApplicationsStore.getState()._subscribeRealtime(),
          useDiscoveryStore.getState()._subscribeRealtime(),
        ]
      }
      setIsLoading(false)
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      syncData(session)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncData(session)
    })

    return () => {
      subscription.unsubscribe()
      teardownRealtime()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, user, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
