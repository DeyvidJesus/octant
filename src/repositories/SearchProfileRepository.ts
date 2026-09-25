import { supabase } from '@/services/supabase/client'
import { type SearchProfile } from '@/types/searchProfile'
import type { MasterResume } from '@/types/resume'
import { BaseRepository } from './BaseRepository'

/** Data access for the per-user search profile; a new account with no row reads as null. */
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

  /** Stores the projected resume in `scoring_snapshot` so the offline worker can score candidates. */
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

/** Shared singleton for stores; the class is exported for tests. */
export const searchProfileRepository = new SearchProfileRepository()
