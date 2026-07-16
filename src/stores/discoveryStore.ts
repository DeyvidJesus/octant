import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DiscoveredCandidate } from '@/types/discovery'
import { appStorage } from '@/services/storage/zustandStorage'
import { STORAGE_KEYS } from '@/services/storage/types'
import { candidateKey } from '@/services/discovery/dedupe'
import { nowIso } from '@/utils/dates'

/**
 * Dismissed keys are remembered so a posting the user rejected doesn't
 * resurface on every subsequent sweep. FIFO-capped: at single-user scale
 * 500 covers years of dismissals without bloating backups.
 */
const MAX_DISMISSED_KEYS = 500

interface DiscoveryState {
  /** The review queue — deduped, scored, awaiting approve/dismiss. */
  candidates: DiscoveredCandidate[]
  dismissedKeys: string[]
  lastSweepAt: string | null
  /** A Deep Research run survives reloads: non-null means "offer to resume". */
  pendingInteractionId: string | null
  addCandidates: (fresh: DiscoveredCandidate[]) => void
  removeCandidates: (ids: string[]) => void
  dismissCandidates: (ids: string[]) => void
  markSweepRan: () => void
  setPendingInteraction: (id: string | null) => void
}

export const useDiscoveryStore = create<DiscoveryState>()(
  persist(
    (set) => ({
      candidates: [],
      dismissedKeys: [],
      lastSweepAt: null,
      pendingInteractionId: null,

      addCandidates: (fresh) => set((state) => ({ candidates: [...fresh, ...state.candidates] })),

      removeCandidates: (ids) =>
        set((state) => ({ candidates: state.candidates.filter((c) => !ids.includes(c.id)) })),

      dismissCandidates: (ids) =>
        set((state) => {
          const dismissed = state.candidates.filter((c) => ids.includes(c.id))
          const keys = [...state.dismissedKeys, ...dismissed.map((c) => candidateKey(c.company, c.role))]
          return {
            candidates: state.candidates.filter((c) => !ids.includes(c.id)),
            dismissedKeys: keys.slice(-MAX_DISMISSED_KEYS),
          }
        }),

      markSweepRan: () => set({ lastSweepAt: nowIso() }),

      setPendingInteraction: (id) => set({ pendingInteractionId: id }),
    }),
    {
      name: STORAGE_KEYS.discovery,
      storage: appStorage,
      version: 1,
    },
  ),
)
