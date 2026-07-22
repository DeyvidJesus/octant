import { supabase } from '@/services/supabase/client'
import { type SearchProfile } from '@/types/searchProfile'
import type { MasterResume } from '@/types/resume'
import { BaseRepository } from './BaseRepository'

/**
 * Data-access boundary for the structured search profile that drives continuous discovery.
 * One row per user in `public.search_profiles` ({id, user_id, data}); RLS-scoped via the session
 * mirror; reads with `maybeSingle()` so a new account (no row yet) resolves to null.
 */
export class SearchProfileRepository extends BaseRepository {
  async getSearchProfile(): Promise<SearchProfile | null> {
    const userId = this.requireUserId()
    const row = this.unwrap(
      await supabase.from('search_profiles').select('data').eq('user_id', userId).maybeSingle(),
      'load your search profile',
    ) as { data?: SearchProfile } | null
    return row?.data ?? null
  }

  async saveSearchProfile(profile: SearchProfile): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase
        .from('search_profiles')
        .upsert(
          { user_id: userId, data: profile, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        ),
      'save your search profile',
    )
  }

  /**
   * Publishes the projected Master Resume so the offline worker can score candidates server-side
   * without reassembling the knowledge base. Only touches `scoring_snapshot` (leaves `data` intact).
   */
  async saveScoringSnapshot(resume: MasterResume): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase
        .from('search_profiles')
        .upsert(
          { user_id: userId, scoring_snapshot: resume, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        ),
      'save your scoring snapshot',
    )
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const searchProfileRepository = new SearchProfileRepository()
