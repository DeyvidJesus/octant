import type { TailoredResume } from '@/types/generator'
import { supabase } from '@/services/supabase/client'
import { nowIso } from '@/utils/dates'
import { BaseRepository } from './BaseRepository'
import { tailoredResumeSchema } from './schemas'

type TailoredMap = Record<string, TailoredResume>

/** Row shape persisted in `public.tailored_resumes` — one row per (user, job). */
interface TailoredResumeRow {
  job_id: string
  data: TailoredResume
}

/** Data access for tailored resumes, one row per job so RLS can enforce plan limits. */
export class TailoredResumeRepository extends BaseRepository {
  /** Loads all tailored resumes for the user, reassembled into the by-jobId map the store uses. */
  async getTailored(): Promise<TailoredMap> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase.from('tailored_resumes').select('job_id, data').eq('user_id', userId),
      'load your tailored resumes',
    ) as TailoredResumeRow[] | null

    const byJobId: TailoredMap = {}
    const resumes = this.parseRows<TailoredResume>(rows?.map((row) => row.data), tailoredResumeSchema, 'tailored_resumes')
    for (const resume of resumes) byJobId[resume.jobId] = resume
    return byJobId
  }

  /** Upserts a single tailored resume. */
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

  async deleteTailored(jobId: string): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('tailored_resumes').delete().eq('user_id', userId).eq('job_id', jobId),
      'delete the tailored resume',
    )
  }
}

/** Shared singleton for stores; the class is exported for tests. */
export const tailoredResumeRepository = new TailoredResumeRepository()
