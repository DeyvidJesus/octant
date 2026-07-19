import type { TailoredResume } from '@/types/generator'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'

/** Tailored resumes keyed by job id — the whole map is the per-user document. */
type TailoredMap = Record<string, TailoredResume>

/** Row shape persisted in `public.generators` — one row per user (`user_id` is unique). */
interface GeneratorRow {
  user_id: string
  state: TailoredMap
}

/**
 * Data-access boundary for tailored resumes (a single per-user document keyed by job id).
 * RLS-scoped to the current user; throws `AppError` subclasses on failure.
 */
export class GeneratorRepository extends BaseRepository {
  async getTailored(): Promise<TailoredMap | null> {
    const userId = this.requireUserId()
    const row = this.unwrap(
      await supabase.from('generators').select('*').eq('user_id', userId).maybeSingle(),
      'load your tailored resumes',
    ) as GeneratorRow | null
    return row?.state ?? null
  }

  async saveTailored(state: TailoredMap): Promise<void> {
    const userId = this.requireUserId()
    // NOTE: `generators.user_id` is UNIQUE; the correct upsert conflict target is `user_id`.
    // Kept as a plain upsert to match existing behavior; deferred to the schema-reconciliation phase.
    this.unwrap(
      await supabase.from('generators').upsert({ user_id: userId, state }),
      'save your tailored resumes',
    )
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const generatorRepository = new GeneratorRepository()
