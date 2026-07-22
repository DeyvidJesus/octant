import { create } from 'zustand'
import { DEFAULT_SEARCH_PROFILE, type SearchProfile } from '@/types/searchProfile'
import { searchProfileRepository } from '@/repositories/SearchProfileRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from '@/repositories/persist'

interface SearchProfileState {
  /** The user's stored, structured search profile. Null until hydrated / first edit. */
  profile: SearchProfile | null
  /** Merges a patch into the profile (seeding from defaults if empty) and persists it. */
  updateProfile: (patch: Partial<SearchProfile>) => void
  _fetchFromSupabase: () => Promise<void>
  reset: () => void
}

export const useSearchProfileStore = create<SearchProfileState>()((set, get) => ({
  profile: null,
  updateProfile: (patch) => {
    const next: SearchProfile = { ...(get().profile ?? DEFAULT_SEARCH_PROFILE), ...patch }
    set({ profile: next })
    persist(() => searchProfileRepository.saveSearchProfile(next), 'searchProfile.update')
  },
  _fetchFromSupabase: async () => {
    try {
      set({ profile: await searchProfileRepository.getSearchProfile() })
    } catch (error) {
      if (error instanceof UnauthenticatedError) return
      console.error('[searchProfileStore] failed to load search profile', error)
    }
  },
  reset: () => set({ profile: null }),
}))
