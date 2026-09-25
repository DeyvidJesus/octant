import type { Application } from '@/types/application'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'
import { applicationSchema } from './schemas'

/** Row shape persisted in `public.applications` — the domain object lives in the `data` JSONB column. */
interface ApplicationRow {
  id: string
  user_id: string
  data: Application
}

/** Data access for applications. RLS-scoped to the current user; throws `AppError` subclasses. */
export class ApplicationRepository extends BaseRepository {
  async getApplications(): Promise<Application[]> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase.from('applications').select('*').eq('user_id', userId),
      'load your applications',
    ) as ApplicationRow[] | null
    return this.parseRows<Application>(rows?.map((row) => row.data), applicationSchema, 'applications')
  }

  async upsertApplication(application: Application): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase
        .from('applications')
        .upsert({ id: application.id, user_id: userId, data: application }),
      'save the application',
    )
  }

  async deleteApplication(id: string): Promise<void> {
    const userId = this.requireUserId()
    this.unwrap(
      await supabase.from('applications').delete().eq('id', id).eq('user_id', userId),
      'delete the application',
    )
  }

  /** Streams cross-device changes to the user's applications. Returns an unsubscribe function. */
  subscribeToApplications(handlers: {
    onUpsert: (application: Application) => void
    onDelete: (id: string) => void
  }): () => void {
    return this.subscribeToOwnedTable<Application>('applications', applicationSchema, (change) => {
      if (change.type === 'upsert') handlers.onUpsert(change.row)
      else handlers.onDelete(change.id)
    })
  }
}

/** Shared singleton for stores; the class is exported for tests. */
export const applicationRepository = new ApplicationRepository()
