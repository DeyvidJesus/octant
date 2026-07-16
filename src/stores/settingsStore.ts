import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AiProviderId, AiSettings } from '@/types/ai'
import type { AiRunConfig } from '@/services/ai/types'
import { DEFAULT_DISCOVERY_PREFS, type DiscoveryPrefs } from '@/types/discovery'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { getProviderDescriptor } from '@/services/ai/registry'
import { loadApiKeys, saveApiKey, removeApiKey } from '@/services/ai/vault'

type ApiKeyMap = Partial<Record<AiProviderId, string>>

interface SettingsState {
  ai: AiSettings
  discovery: DiscoveryPrefs
  /** In-memory mirror of the vault. Never persisted through this store. */
  apiKeys: ApiKeyMap
  keysHydrated: boolean
  setProvider: (id: AiProviderId | null) => void
  setModel: (model: string) => void
  setBaseUrl: (baseUrl: string) => void
  setDiscoveryPrefs: (patch: Partial<DiscoveryPrefs>) => void
  setApiKey: (id: AiProviderId, key: string) => void
  clearApiKey: (id: AiProviderId) => void
  /** Load keys from the vault into memory (idempotent). */
  hydrateKeys: () => Promise<void>
}

const DEFAULT_AI: AiSettings = { providerId: null, model: '', baseUrl: undefined }

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ai: DEFAULT_AI,
      discovery: DEFAULT_DISCOVERY_PREFS,
      apiKeys: {},
      keysHydrated: false,

      setProvider: (id) => {
        // Switching providers resets model + endpoint to that provider's
        // defaults so the selection is always internally consistent.
        const descriptor = id ? getProviderDescriptor(id) : undefined
        set({
          ai: {
            providerId: id,
            model: descriptor?.models[0]?.id ?? '',
            baseUrl: descriptor?.defaultBaseUrl,
          },
        })
      },

      setModel: (model) => set((state) => ({ ai: { ...state.ai, model } })),
      setBaseUrl: (baseUrl) => set((state) => ({ ai: { ...state.ai, baseUrl } })),

      setDiscoveryPrefs: (patch) => set((state) => ({ discovery: { ...state.discovery, ...patch } })),

      setApiKey: (id, key) => {
        set((state) => ({ apiKeys: { ...state.apiKeys, [id]: key } }))
        void saveApiKey(id, key)
      },

      clearApiKey: (id) => {
        set((state) => {
          const next = { ...state.apiKeys }
          delete next[id]
          return { apiKeys: next }
        })
        void removeApiKey(id)
      },

      hydrateKeys: async () => {
        if (get().keysHydrated) return
        const keys = await loadApiKeys()
        set({ apiKeys: keys, keysHydrated: true })
      },
    }),
    {
      name: STORAGE_KEYS.settings,
      storage: appStorage,
      version: 1,
      // Persist only the non-secret selection. API keys live in the vault
      // (services/ai/vault) so they never enter a backup.
      partialize: (state) => ({ ai: state.ai, discovery: state.discovery }),
    },
  ),
)

/**
 * Resolve the current selection into a runnable config, or null if the setup
 * is incomplete (no provider, no model, or a missing required key). Derived
 * from the primitive store slices so it stays referentially cheap.
 */
export function resolveAiRunConfig(ai: AiSettings, apiKeys: ApiKeyMap): AiRunConfig | null {
  if (!ai.providerId || !ai.model.trim()) return null
  const descriptor = getProviderDescriptor(ai.providerId)
  const apiKey = apiKeys[ai.providerId]
  if (descriptor?.requiresApiKey && !apiKey) return null
  return { providerId: ai.providerId, model: ai.model.trim(), apiKey, baseUrl: ai.baseUrl }
}
