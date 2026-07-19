import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase/client'
import { setSessionUserId } from '@/services/supabase/session'
import { useJobsStore } from '@/stores/jobsStore'
import { useApplicationsStore } from '@/stores/applicationsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useResumeStore } from '@/stores/resumeStore'
import { useInterviewPrepStore } from '@/stores/interviewPrepStore'
import { useGeneratorStore } from '@/stores/generatorStore'
import { useDiscoveryStore } from '@/stores/discoveryStore'

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

    const syncData = async (session: Session | null) => {
      // Mirror the user id into the module-level session holder BEFORE any repository call, so the
      // repository layer resolves it synchronously (no per-write `auth.getUser()` network round-trip).
      setSessionUserId(session?.user?.id ?? null)
      setSession(session)
      setUser(session?.user ?? null)
      teardownRealtime()
      if (session?.user) {
        await Promise.all([
          useJobsStore.getState()._fetchFromSupabase?.(),
          useApplicationsStore.getState()._fetchFromSupabase?.(),
          useSettingsStore.getState()._fetchFromSupabase?.(),
          useResumeStore.getState()._fetchFromSupabase?.(),
          useInterviewPrepStore.getState()._fetchFromSupabase?.(),
          useGeneratorStore.getState()._fetchFromSupabase?.(),
          useDiscoveryStore.getState()._fetchFromSupabase?.(),
        ])
        // Subscribe after the initial load so realtime deltas apply on top of a hydrated store.
        realtimeCleanups = [
          useJobsStore.getState()._subscribeRealtime(),
          useApplicationsStore.getState()._subscribeRealtime(),
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
