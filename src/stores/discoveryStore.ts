import { create } from 'zustand'
import type { DiscoveredCandidate, DiscoveryRun } from '@/types/discovery'
import type { DiscoveryProgress } from '@/services/discovery/pipeline'
import {
  buildSignalFeatures,
  learnPreferences,
  rankScore,
  type DiscoverySignal,
  type LearnedPreferences,
  type SignalAction,
} from '@/services/discovery/signals'
import { candidateKey } from '@/services/discovery/dedupe'
import { nowIso } from '@/utils/dates'
import { discoveryRepository, type DiscoveryMeta } from '@/repositories/DiscoveryRepository'
import { UnauthenticatedError } from '@/repositories/errors'
import { persist } from './persist'
import { useToastStore } from '@/stores/toastStore'

const MAX_DISMISSED_KEYS = 500

const EMPTY_PREFERENCES: LearnedPreferences = { technologyScores: {}, workModeScores: {}, dislikedCompanies: [] }

/** Ranks by the learned-preference-adjusted score; unscored sink to the bottom; ties by recency. */
function sortByRank(candidates: DiscoveredCandidate[], prefs: LearnedPreferences): DiscoveredCandidate[] {
  return [...candidates].sort((a, b) => {
    const ra = rankScore(a, prefs)
    const rb = rankScore(b, prefs)
    if (ra !== rb) return rb - ra
    return (b.foundAt ?? '').localeCompare(a.foundAt ?? '')
  })
}

/** Idempotent-by-id merge (realtime echo / rescore replaces), then re-rank. */
function mergeCandidate(
  list: DiscoveredCandidate[],
  candidate: DiscoveredCandidate,
  prefs: LearnedPreferences,
): DiscoveredCandidate[] {
  const next = list.some((c) => c.id === candidate.id)
    ? list.map((c) => (c.id === candidate.id ? candidate : c))
    : [candidate, ...list]
  return sortByRank(next, prefs)
}

interface DiscoveryState {
  candidates: DiscoveredCandidate[]
  dismissedKeys: string[]
  lastSweepAt: string | null
  /** When the user last opened the feed; drives the "N new" badge. */
  lastSeenAt: string | null
  pendingInteractionId: string | null
  currentRun: DiscoveryRun | null
  progress: DiscoveryProgress | null
  /** Raw learning signals and the preferences aggregated from them. */
  signals: DiscoverySignal[]
  learnedPreferences: LearnedPreferences
  addCandidates: (fresh: DiscoveredCandidate[]) => void
  receiveCandidate: (candidate: DiscoveredCandidate) => void
  removeCandidates: (ids: string[]) => void
  dismissCandidates: (ids: string[]) => void
  markSweepRan: () => void
  /** Marks the feed as seen "now" so the unseen count resets. */
  markSeen: () => void
  setPendingInteraction: (id: string | null) => void
  setRun: (run: DiscoveryRun | null) => void
  setProgress: (progress: DiscoveryProgress | null) => void
  _fetchFromSupabase: () => Promise<void>
  _subscribeRealtime: () => () => void
  reset: () => void
}

export const useDiscoveryStore = create<DiscoveryState>()(
  (set, get) => {
    const persistMeta = (context: string) => {
      const { dismissedKeys, lastSweepAt, pendingInteractionId, lastSeenAt } = get()
      const meta: DiscoveryMeta = { dismissedKeys, lastSweepAt, pendingInteractionId, lastSeenAt }
      persist(() => discoveryRepository.saveMeta(meta), context)
    }

    // Notify once per finished background run that produced fresh candidates.
    let lastNotifiedRunId: string | null = null
    const maybeNotifyRun = (run: DiscoveryRun) => {
      const done = run.status === 'succeeded' || run.status === 'partial'
      const fresh = run.stats.fresh ?? 0
      if (run.trigger === 'scheduled' && done && fresh > 0 && run.id !== lastNotifiedRunId) {
        lastNotifiedRunId = run.id
        useToastStore
          .getState()
          .notify(`Your discovery agent found ${fresh} new ${fresh === 1 ? 'opportunity' : 'opportunities'}.`, 'info')
      }
    }

    /** Captures reactions as learning signals: appends, re-aggregates prefs, re-ranks, persists. */
    const recordSignals = (candidates: DiscoveredCandidate[], action: SignalAction) => {
      if (candidates.length === 0) return
      const newSignals: DiscoverySignal[] = candidates.map((c) => ({ action, features: buildSignalFeatures(c) }))
      set((state) => {
        const signals = [...newSignals, ...state.signals]
        const learnedPreferences = learnPreferences(signals)
        return { signals, learnedPreferences, candidates: sortByRank(state.candidates, learnedPreferences) }
      })
      for (const signal of newSignals) {
        persist(() => discoveryRepository.recordSignal(signal.action, signal.features), 'discovery.recordSignal')
      }
    }

    return {
      candidates: [],
      dismissedKeys: [],
      lastSweepAt: null,
      lastSeenAt: null,
      pendingInteractionId: null,
      currentRun: null,
      progress: null,
      signals: [],
      learnedPreferences: EMPTY_PREFERENCES,

      addCandidates: (fresh) => {
        set((state) => ({
          candidates: fresh.reduce((list, c) => mergeCandidate(list, c, state.learnedPreferences), state.candidates),
        }))
        persist(() => discoveryRepository.insertCandidates(fresh), 'discovery.addCandidates')
      },

      receiveCandidate: (candidate) => {
        set((state) => ({ candidates: mergeCandidate(state.candidates, candidate, state.learnedPreferences) }))
      },

      removeCandidates: (ids) => {
        const approved = get().candidates.filter((c) => ids.includes(c.id))
        set((state) => ({ candidates: state.candidates.filter((c) => !ids.includes(c.id)) }))
        persist(() => discoveryRepository.setStatus(ids, 'approved'), 'discovery.removeCandidates')
        recordSignals(approved, 'approved')
      },

      dismissCandidates: (ids) => {
        const dismissed = get().candidates.filter((c) => ids.includes(c.id))
        set((state) => {
          const keys = [...state.dismissedKeys, ...dismissed.map((c) => candidateKey(c.company, c.role))]
          return {
            candidates: state.candidates.filter((c) => !ids.includes(c.id)),
            dismissedKeys: keys.slice(-MAX_DISMISSED_KEYS),
          }
        })
        persist(() => discoveryRepository.setStatus(ids, 'rejected'), 'discovery.dismissCandidates')
        persistMeta('discovery.dismissCandidates.meta')
        recordSignals(dismissed, 'dismissed')
      },

      markSweepRan: () => {
        set({ lastSweepAt: nowIso() })
        persistMeta('discovery.markSweepRan')
      },

      markSeen: () => {
        set({ lastSeenAt: nowIso() })
        persistMeta('discovery.markSeen')
      },

      setPendingInteraction: (id) => {
        set({ pendingInteractionId: id })
        persistMeta('discovery.setPendingInteraction')
      },

      setRun: (run) => set({ currentRun: run }),
      setProgress: (progress) => set({ progress }),

      _fetchFromSupabase: async () => {
        try {
          const [candidates, meta, runs, signals] = await Promise.all([
            discoveryRepository.getPendingCandidates(),
            discoveryRepository.getMeta(),
            discoveryRepository.getRecentRuns(1).catch(() => []),
            discoveryRepository.getSignals().catch(() => [] as DiscoverySignal[]),
          ])
          const learnedPreferences = learnPreferences(signals)
          set({
            candidates: sortByRank(candidates, learnedPreferences),
            dismissedKeys: meta?.dismissedKeys ?? [],
            lastSweepAt: meta?.lastSweepAt ?? null,
            lastSeenAt: meta?.lastSeenAt ?? null,
            pendingInteractionId: meta?.pendingInteractionId ?? null,
            currentRun: runs[0] ?? null,
            signals,
            learnedPreferences,
          })
        } catch (error) {
          if (error instanceof UnauthenticatedError) return
          console.error('[discoveryStore] failed to load from Supabase', error)
        }
      },

      _subscribeRealtime: () => {
        const unsubFeed = discoveryRepository.subscribeToDiscovered({
          onUpsert: (candidate) => get().receiveCandidate(candidate),
          onRemove: (id) => set((state) => ({ candidates: state.candidates.filter((c) => c.id !== id) })),
        })
        const unsubRuns = discoveryRepository.subscribeToRuns((run) => {
          set({ currentRun: run })
          maybeNotifyRun(run)
        })
        return () => {
          unsubFeed()
          unsubRuns()
        }
      },

      reset: () =>
        set({
          candidates: [],
          dismissedKeys: [],
          lastSweepAt: null,
          lastSeenAt: null,
          pendingInteractionId: null,
          currentRun: null,
          progress: null,
          signals: [],
          learnedPreferences: EMPTY_PREFERENCES,
        }),
    }
  },
)
