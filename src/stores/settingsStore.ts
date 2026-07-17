import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AiRunConfig } from '@/services/ai/types'
import { DEFAULT_DISCOVERY_PREFS, type DiscoveryPrefs } from '@/types/discovery'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'

interface SettingsState {
  discovery: DiscoveryPrefs
  onboardingCompleted: boolean
  setDiscoveryPrefs: (patch: Partial<DiscoveryPrefs>) => void
  completeOnboarding: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      discovery: DEFAULT_DISCOVERY_PREFS,
      onboardingCompleted: false,

      setDiscoveryPrefs: (patch) => set((state) => ({ discovery: { ...state.discovery, ...patch } })),
      completeOnboarding: () => set({ onboardingCompleted: true }),
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: appStorage,
      version: 2,
      partialize: (state) => ({ discovery: state.discovery, onboardingCompleted: state.onboardingCompleted }),
    },
  ),
)

/**
 * Resolve the current selection into a runnable config.
 * Now hardcoded to use OpenAI via environment variables.
 */
export function resolveAiRunConfig(): AiRunConfig | null {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY
  if (!apiKey) return null
  return { providerId: 'openai', model: 'gpt-4o', apiKey }
}
