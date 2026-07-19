import type { DiscoveredCandidate } from '@/types/discovery'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'

export type DiscoveredJobStatus = 'pending' | 'approved' | 'rejected'

/**
 * Small, bounded review metadata retained in the `discoveries.state` blob after normalization.
 * Deliberately excludes candidate arrays — those are now rows in `discovered_jobs`.
 */
export interface DiscoveryMeta {
  dismissedKeys: string[]
  lastSweepAt: string | null
  pendingInteractionId: string | null
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

  /** Inserts freshly scraped candidates as individual pending rows. */
  async insertCandidates(candidates: DiscoveredCandidate[]): Promise<void> {
    if (candidates.length === 0) return
    const userId = this.requireUserId()
    const rows = candidates.map((candidate) => ({
      id: candidate.id,
      user_id: userId,
      url: candidate.url ?? null,
      status: 'pending' as const,
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
    // NOTE: `discoveries.user_id` is UNIQUE; the correct upsert conflict target is `user_id`.
    // Kept as a plain upsert to match existing behavior; conflict-target wiring is deferred to the
    // schema-reconciliation phase (consistent with resume/generator repos).
    this.unwrap(
      await supabase.from('discoveries').upsert({ user_id: userId, state: meta }),
      'save your discovery settings',
    )
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const discoveryRepository = new DiscoveryRepository()
