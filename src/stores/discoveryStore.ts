import { create } from 'zustand'
import type { DiscoveredCandidate } from '@/types/discovery'
import { candidateKey } from '@/services/discovery/dedupe'
import { nowIso } from '@/utils/dates'
import { discoveryRepository, type DiscoveryMeta } from '@/repositories/DiscoveryRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from '@/repositories/persist'

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
  _fetchFromSupabase: () => Promise<void>
  /** Clears in-memory state (sign-out / user switch) so no data bleeds across sessions. */
  reset: () => void
}

export const useDiscoveryStore = create<DiscoveryState>()(
  (set, get) => {
    /**
     * Persists ONLY the small review metadata (dedupe keys + timestamps) to the `discoveries`
     * blob. The candidate queue itself lives in the relational `discovered_jobs` table and is
     * never re-uploaded wholesale — that was the multi-megabyte-per-swipe bug this phase removes.
     */
    const persistMeta = (context: string) => {
      const { dismissedKeys, lastSweepAt, pendingInteractionId } = get()
      const meta: DiscoveryMeta = { dismissedKeys, lastSweepAt, pendingInteractionId }
      persist(() => discoveryRepository.saveMeta(meta), context)
    }

    return {
      candidates: [],
      dismissedKeys: [],
      lastSweepAt: null,
      pendingInteractionId: null,

      addCandidates: (fresh) => {
        set((state) => ({ candidates: [...fresh, ...state.candidates] }))
        // Each scraped candidate becomes its own pending row — targeted inserts, not a blob upload.
        persist(() => discoveryRepository.insertCandidates(fresh), 'discovery.addCandidates')
      },

      removeCandidates: (ids) => {
        set((state) => ({ candidates: state.candidates.filter((c) => !ids.includes(c.id)) }))
        // Approve path: flip just these rows to 'approved'.
        persist(() => discoveryRepository.setStatus(ids, 'approved'), 'discovery.removeCandidates')
      },

      dismissCandidates: (ids) => {
        set((state) => {
          const dismissed = state.candidates.filter((c) => ids.includes(c.id))
          const keys = [...state.dismissedKeys, ...dismissed.map((c) => candidateKey(c.company, c.role))]
          return {
            candidates: state.candidates.filter((c) => !ids.includes(c.id)),
            dismissedKeys: keys.slice(-MAX_DISMISSED_KEYS),
          }
        })
        // Reject path: flip just these rows to 'rejected', then persist the (small) dedupe-key list.
        persist(() => discoveryRepository.setStatus(ids, 'rejected'), 'discovery.dismissCandidates')
        persistMeta('discovery.dismissCandidates.meta')
      },

      markSweepRan: () => {
        set({ lastSweepAt: nowIso() })
        persistMeta('discovery.markSweepRan')
      },

      setPendingInteraction: (id) => {
        set({ pendingInteractionId: id })
        persistMeta('discovery.setPendingInteraction')
      },

      _fetchFromSupabase: async () => {
        try {
          const [candidates, meta] = await Promise.all([
            discoveryRepository.getPendingCandidates(),
            discoveryRepository.getMeta(),
          ])
          set({
            candidates,
            dismissedKeys: meta?.dismissedKeys ?? [],
            lastSweepAt: meta?.lastSweepAt ?? null,
            pendingInteractionId: meta?.pendingInteractionId ?? null,
          })
        } catch (error) {
          if (error instanceof UnauthenticatedError) return
          console.error('[discoveryStore] failed to load from Supabase', error)
        }
      },
      reset: () =>
        set({ candidates: [], dismissedKeys: [], lastSweepAt: null, pendingInteractionId: null }),
    }
  },
)
