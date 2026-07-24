import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import type {
  DiscoveredCandidate,
  DiscoveryRun,
  DiscoveryRunStats,
  DiscoveryRunStatus,
  DiscoveryRunTrigger,
} from '@/types/discovery'
import { supabase } from '@/services/supabase/client'
import { getSessionUserId } from '@/services/supabase/session'
import type { DiscoverySignal, SignalAction, SignalFeatures } from '@/services/discovery/signals'
import { BaseRepository } from './BaseRepository'

export type DiscoveredJobStatus = 'pending' | 'approved' | 'rejected'

/** DB row shape for a discovery_runs record. */
interface DiscoveryRunRow {
  id: string
  status: DiscoveryRunStatus
  trigger: DiscoveryRunTrigger
  stats: DiscoveryRunStats | null
  tokens_used: number | null
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

function toRun(row: DiscoveryRunRow): DiscoveryRun {
  return {
    id: row.id,
    status: row.status,
    trigger: row.trigger,
    stats: row.stats ?? {},
    tokensUsed: row.tokens_used ?? 0,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  }
}

/**
 * Small, bounded review metadata retained in the `discoveries.state` blob after normalization.
 * Deliberately excludes candidate arrays — those are now rows in `discovered_jobs`.
 */
export interface DiscoveryMeta {
  dismissedKeys: string[]
  lastSweepAt: string | null
  pendingInteractionId: string | null
  /** When the user last opened the feed — drives the "N new since you last looked" proactive surface. */
  lastSeenAt?: string | null
}

/** Row shape persisted in `public.discovered_jobs` — the candidate lives in the `data` column. */
interface DiscoveredJobRow {
  id: string
  user_id: string
  url: string | null
  status: DiscoveredJobStatus
  data: DiscoveredCandidate
  created_at: string
}

/** Page size for the paginated pending-queue read. Keeps any single request bounded. */
const PAGE_SIZE = 200

/**
 * Data-access boundary for job discovery. The review queue is a relational table (one row per
 * scraped candidate); triage actions are targeted INSERT/UPDATE statements, never a whole-array
 * upload. RLS-scoped to the current user; throws `AppError` subclasses on failure.
 */
export class DiscoveryRepository extends BaseRepository {
  /**
   * Loads every pending candidate for the user, paging through with `.range()` so a single
   * request never has to return thousands of rows. Ordered newest-first to match the review queue.
   */
  async getPendingCandidates(): Promise<DiscoveredCandidate[]> {
    const userId = this.requireUserId()
    const candidates: DiscoveredCandidate[] = []

    for (let from = 0; ; from += PAGE_SIZE) {
      const rows = this.unwrap(
        await supabase
          .from('discovered_jobs')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1),
        'load your discovered jobs',
      ) as DiscoveredJobRow[] | null

      if (!rows || rows.length === 0) break
      for (const row of rows) candidates.push(row.data)
      if (rows.length < PAGE_SIZE) break
    }

    return candidates
  }

  /** Overwrites a single candidate's stored blob + score (used to persist AI enrichment). */
  async updateCandidateData(candidate: DiscoveredCandidate): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase
        .from('discovered_jobs')
        .update({ data: candidate, score: candidate.matchScore ?? null })
        .eq('user_id', userId)
        .eq('id', candidate.id),
      'update the discovered job',
    )
  }

  /** Inserts freshly scraped candidates as individual pending rows. */
  async insertCandidates(candidates: DiscoveredCandidate[]): Promise<void> {
    if (candidates.length === 0) return
    const userId = this.requireUserId()
    const rows = candidates.map((candidate) => ({
      id: candidate.id,
      user_id: userId,
      url: candidate.url ?? null,
      status: 'pending' as const,
      score: candidate.matchScore ?? null,
      data: candidate,
    }))
    this.unwrap(await supabase.from('discovered_jobs').insert(rows), 'save the discovered jobs')
  }

  /**
   * Flips the status of specific candidates (approve → 'approved', dismiss → 'rejected').
   * A single targeted UPDATE over the given ids — never a re-upload of the whole queue.
   */
  async setStatus(ids: string[], status: DiscoveredJobStatus): Promise<void> {
    if (ids.length === 0) return
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('discovered_jobs').update({ status }).eq('user_id', userId).in('id', ids),
      'update the discovered jobs',
    )
  }

  // ── Learning signals ────────────────────────────────────────────────────────────────────────────

  /** Records one reaction (approve/dismiss/save/apply/interested) with the candidate's features. */
  async recordSignal(action: SignalAction, features: SignalFeatures): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('discovery_signals').insert({ user_id: userId, action, features }),
      'record a discovery signal',
    )
  }

  /** Loads recent signals (newest first) for preference aggregation. */
  async getSignals(limit = 500): Promise<DiscoverySignal[]> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase
        .from('discovery_signals')
        .select('action, features')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      'load your discovery signals',
    ) as Array<{ action: SignalAction; features: SignalFeatures }> | null
    return (rows ?? []).map((row) => ({ action: row.action, features: row.features }))
  }

  /** Reads the small review-metadata blob (dedupe keys + timestamps). */
  async getMeta(): Promise<DiscoveryMeta | null> {
    const userId = this.requireUserId()
    const row = this.unwrap(
      await supabase.from('discoveries').select('state').eq('user_id', userId).maybeSingle(),
      'load your discovery settings',
    ) as { state: DiscoveryMeta } | null
    return row?.state ?? null
  }

  /** Persists the small review-metadata blob. Bounded in size (no candidate arrays). */
  async saveMeta(meta: DiscoveryMeta): Promise<void> {
    const userId = this.requireUserId()
    // `discoveries.user_id` is UNIQUE — upsert on that conflict target so repeated saves UPDATE the
    // single row instead of trying to INSERT a duplicate (which errored with 23505).
    this.unwrap(
      await supabase.from('discoveries').upsert({ user_id: userId, state: meta }, { onConflict: 'user_id' }),
      'save your discovery settings',
    )
  }

  // ── Realtime: stream the discovery feed + run status to the client ──────────────────────────────

  /**
   * Streams changes to the user's discovered_jobs. A row is dispatched to `onUpsert` while it is
   * still 'pending' (it belongs in the feed) and to `onRemove` once approved/rejected or deleted —
   * so cross-device triage and worker-inserted candidates both reflect live. Returns an unsubscribe.
   */
  subscribeToDiscovered(handlers: {
    onUpsert: (candidate: DiscoveredCandidate) => void
    onRemove: (id: string) => void
  }): () => void {
    const userId = getSessionUserId()
    if (!userId) return () => {}

    const channel = supabase
      .channel(`realtime:discovered_jobs:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discovered_jobs', filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<{ id: string; status: DiscoveredJobStatus; data: DiscoveredCandidate }>) => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id
            if (typeof id === 'string') handlers.onRemove(id)
            return
          }
          const row = payload.new
          if (!row?.data) return
          if (row.status === 'pending') handlers.onUpsert(row.data)
          else handlers.onRemove(row.data.id)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }

  /** Streams discovery_runs changes so the "agent status" reflects live progress. */
  subscribeToRuns(onChange: (run: DiscoveryRun) => void): () => void {
    const userId = getSessionUserId()
    if (!userId) return () => {}

    const channel = supabase
      .channel(`realtime:discovery_runs:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'discovery_runs', filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<DiscoveryRunRow>) => {
          if (payload.eventType === 'DELETE') return
          const row = payload.new
          if (row?.id) onChange(toRun(row as DiscoveryRunRow))
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }

  /** Most recent runs, newest first — for the agent status header + history. */
  async getRecentRuns(limit = 5): Promise<DiscoveryRun[]> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase
        .from('discovery_runs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit),
      'load your discovery runs',
    ) as DiscoveryRunRow[] | null
    return (rows ?? []).map(toRun)
  }

  /** Opens a new in-session run row (status 'running') and returns its id. */
  async createRun(trigger: DiscoveryRunTrigger): Promise<string> {
    const userId = this.requireUserId()
    const row = this.unwrap(
      await supabase
        .from('discovery_runs')
        .insert({ user_id: userId, trigger, status: 'running', started_at: new Date().toISOString() })
        .select('id')
        .single(),
      'start a discovery run',
    ) as { id: string }
    return row.id
  }

  /** Patches a run (status/stats/error/finished_at). */
  async updateRun(
    id: string,
    patch: { status?: DiscoveryRunStatus; stats?: DiscoveryRunStats; error?: string | null; finishedAt?: string | null },
  ): Promise<void> {
    const userId = this.requireUserId()
    const row: Record<string, unknown> = {}
    if (patch.status !== undefined) row.status = patch.status
    if (patch.stats !== undefined) row.stats = patch.stats
    if (patch.error !== undefined) row.error = patch.error
    if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt
    this.unwrap(
      await supabase.from('discovery_runs').update(row).eq('user_id', userId).eq('id', id),
      'update the discovery run',
    )
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const discoveryRepository = new DiscoveryRepository()
