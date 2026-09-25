import type { JobOpportunity } from '@/types/job'
import type { JobAnalysis } from '@/types/analysis'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'

/** Row shape persisted in `public.jobs` — the domain object lives in the `data` JSONB column. */
interface JobRow {
  id: string
  user_id: string
  data: JobOpportunity
}

/** Row shape persisted in `public.job_analyses`. */
interface JobAnalysisRow {
  job_id: string
  user_id: string
  match_score: number
  data: JobAnalysis
}

/** Data access for jobs and their ATS analyses. RLS-scoped; throws `AppError` subclasses. */
export class JobRepository extends BaseRepository {
  async getJobs(): Promise<JobOpportunity[]> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase.from('jobs').select('*').eq('user_id', userId),
      'load your jobs',
    ) as JobRow[] | null
    return (rows ?? []).map((row) => row.data)
  }

  async upsertJob(job: JobOpportunity): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('jobs').upsert({ id: job.id, user_id: userId, data: job }),
      'save the job',
    )
  }

  async upsertJobs(jobs: JobOpportunity[]): Promise<void> {
    if (jobs.length === 0) return
    const userId = this.requireUserId()
    const rows = jobs.map((job) => ({ id: job.id, user_id: userId, data: job }))
    this.unwrap(await supabase.from('jobs').upsert(rows), 'save the jobs')
  }

  async deleteJob(id: string): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('jobs').delete().eq('id', id).eq('user_id', userId),
      'delete the job',
    )
  }

  async getAnalyses(): Promise<Record<string, JobAnalysis>> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase.from('job_analyses').select('*').eq('user_id', userId),
      'load your job analyses',
    ) as JobAnalysisRow[] | null

    const byJobId: Record<string, JobAnalysis> = {}
    for (const row of rows ?? []) {
      byJobId[row.job_id] = row.data
    }
    return byJobId
  }

  /** Streams cross-device changes to the user's jobs (analyses are not streamed). Returns an unsubscribe. */
  subscribeToJobs(handlers: {
    onUpsert: (job: JobOpportunity) => void
    onDelete: (id: string) => void
  }): () => void {
    return this.subscribeToOwnedTable<JobOpportunity>('jobs', (change) => {
      if (change.type === 'upsert') handlers.onUpsert(change.row)
      else handlers.onDelete(change.id)
    })
  }

  async upsertAnalysis(analysis: JobAnalysis): Promise<void> {
    const userId = this.requireUserId()
    // One analysis per (user, job), enforced by the `uq_job_analyses_user_job` unique index.
    this.unwrap(
      await supabase.from('job_analyses').upsert(
        {
          job_id: analysis.jobId,
          user_id: userId,
          match_score: analysis.match.atsScore,
          data: analysis,
        },
        { onConflict: 'user_id,job_id' },
      ),
      'save the job analysis',
    )
  }
}

/** Shared singleton for stores; the class is exported for tests. */
export const jobRepository = new JobRepository()
