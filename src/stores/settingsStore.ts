import { create } from 'zustand'
import type { AiRunConfig } from '@/services/ai/types'
import { DEFAULT_DISCOVERY_PREFS, type DiscoveryPrefs } from '@/types/discovery'
import { settingsRepository } from '@/repositories/SettingsRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from './persist'

interface SettingsState {
  /** Legacy free-text discovery prefs, kept only so older rows round-trip. Discovery now reads
   * `search_profiles` (edited in SearchProfileSettings). */
  discovery: DiscoveryPrefs
  onboardingCompleted: boolean
  completeOnboarding: () => void
  _fetchFromSupabase: () => Promise<void>
  /** Clears in-memory state (sign-out / user switch) so no data bleeds across sessions. */
  reset: () => void
}

export const useSettingsStore = create<SettingsState>()(
  (set, get) => ({
    discovery: DEFAULT_DISCOVERY_PREFS,
    onboardingCompleted: false,

    completeOnboarding: () => {
      set({ onboardingCompleted: true })
      persist(
        () => settingsRepository.saveSettings({ discovery: get().discovery, onboardingCompleted: get().onboardingCompleted }),
        'settings.completeOnboarding',
      )
    },
    _fetchFromSupabase: async () => {
      try {
        const stored = await settingsRepository.getSettings()
        if (stored) set({ discovery: stored.discovery, onboardingCompleted: stored.onboardingCompleted })
      } catch (error) {
        if (error instanceof UnauthenticatedError) return
        console.error('[settingsStore] failed to load settings', error)
      }
    },
    reset: () => set({ discovery: DEFAULT_DISCOVERY_PREFS, onboardingCompleted: false }),
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
export function resolveAiRunConfig(): AiRunConfig {
  return { providerId: 'openai', model: 'gpt-4o' }
}
