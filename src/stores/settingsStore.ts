import { create } from 'zustand'
import type { AiRunConfig } from '@/services/ai/types'
import { DEFAULT_DISCOVERY_PREFS, type DiscoveryPrefs } from '@/types/discovery'
import { supabase } from '@/services/supabase/client'

interface SettingsState {
  discovery: DiscoveryPrefs
  onboardingCompleted: boolean
  setDiscoveryPrefs: (patch: Partial<DiscoveryPrefs>) => void
  completeOnboarding: () => void
  _fetchFromSupabase: () => Promise<void>
}

export const useSettingsStore = create<SettingsState>()(
  (set, get) => ({
    discovery: DEFAULT_DISCOVERY_PREFS,
    onboardingCompleted: false,

    setDiscoveryPrefs: (patch) => {
      set((state) => ({ discovery: { ...state.discovery, ...patch } }))
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from('settings').upsert({
            user_id: data.user.id,
            preferences: { discovery: get().discovery, onboardingCompleted: get().onboardingCompleted }
          }).then()
        }
      })
    },
    completeOnboarding: () => {
      set({ onboardingCompleted: true })
      supabase.auth.getUser().then(({ data }) => {
        if (data.user) {
          supabase.from('settings').upsert({
            user_id: data.user.id,
            preferences: { discovery: get().discovery, onboardingCompleted: get().onboardingCompleted }
          }).then()
        }
      })
    },
    _fetchFromSupabase: async () => {
      const { data: userResp } = await supabase.auth.getUser()
      if (!userResp.user) return

      const { data } = await supabase.from('settings').select('*').eq('user_id', userResp.user.id).single()
      if (data && data.preferences) {
        set({
          discovery: data.preferences.discovery ?? DEFAULT_DISCOVERY_PREFS,
          onboardingCompleted: data.preferences.onboardingCompleted ?? false
        })
      }
    }
  })
)

/**
 * Resolve the current selection into a runnable config.
 *
 * Vendor keys live server-side in the `ai-proxy` Edge Function (Phase 6), so the client no longer
 * needs a `VITE_OPENAI_API_KEY` to enable AI features — the proxy injects the key and authorizes by
 * the user's JWT. Returns a default hosted config; the proxy surfaces a clear error if its key is
 * unset. (`apiKey` is intentionally omitted — proxied providers ignore any client key.)
 */
export function resolveAiRunConfig(): AiRunConfig | null {
  return { providerId: 'openai', model: 'gpt-4o' }
}
