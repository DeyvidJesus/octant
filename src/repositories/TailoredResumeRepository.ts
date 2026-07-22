import type { TailoredResume } from '@/types/generator'
import { supabase } from '@/services/supabase/client'
import { nowIso } from '@/utils/dates'
import { BaseRepository } from './BaseRepository'

type TailoredMap = Record<string, TailoredResume>

/** Row shape persisted in `public.tailored_resumes` — one row per (user, job). */
interface TailoredResumeRow {
  job_id: string
  data: TailoredResume
}

/**
 * Data-access boundary for tailored resumes, one relational row per job (normalized from the old
 * `generators` blob so RLS can enforce per-user plan limits). RLS-scoped to the current user;
 * throws `AppError` subclasses on failure.
 */
export class TailoredResumeRepository extends BaseRepository {
  /** Loads all tailored resumes for the user, reassembled into the by-jobId map the store uses. */
  async getTailored(): Promise<TailoredMap> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase.from('tailored_resumes').select('job_id, data').eq('user_id', userId),
      'load your tailored resumes',
    ) as TailoredResumeRow[] | null

    const byJobId: TailoredMap = {}
    for (const row of rows ?? []) byJobId[row.job_id] = row.data
    return byJobId
  }

  /** Upserts a single tailored resume (targeted write — never the whole collection). */
  async saveTailored(resume: TailoredResume): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('tailored_resumes').upsert(
        { user_id: userId, job_id: resume.jobId, data: resume, updated_at: nowIso() },
        { onConflict: 'user_id,job_id' },
      ),
      'save the tailored resume',
    )
  }

  /** Deletes the tailored resume for one job. */
  async deleteTailored(jobId: string): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('tailored_resumes').delete().eq('user_id', userId).eq('job_id', jobId),
      'delete the tailored resume',
    )
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const tailoredResumeRepository = new TailoredResumeRepository()
