import { create } from 'zustand'
import type { AiRunConfig } from '@/services/ai/types'
import { DEFAULT_DISCOVERY_PREFS, type DiscoveryPrefs } from '@/types/discovery'
import { settingsRepository } from '@/repositories/SettingsRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from './persist'

interface SettingsState {
  /** Legacy discovery prefs kept so older rows round-trip; discovery now reads `search_profiles`. */
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

/** Returns the default hosted AI config. No `apiKey`: `ai-proxy` holds vendor keys and authorizes by JWT. */
export function resolveAiRunConfig(): AiRunConfig {
  return { providerId: 'openai', model: 'gpt-4o' }
}
