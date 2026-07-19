import type { Application } from '@/types/application'
import { supabase } from '@/services/supabase/client'
import { BaseRepository } from './BaseRepository'

/** Row shape persisted in `public.applications` — the domain object lives in the `data` JSONB column. */
interface ApplicationRow {
  id: string
  user_id: string
  data: Application
}

/**
 * Data-access boundary for the application-tracker domain.
 * All methods are RLS-scoped to the current user and throw `AppError` subclasses on failure.
 */
export class ApplicationRepository extends BaseRepository {
  async getApplications(): Promise<Application[]> {
    const userId = this.requireUserId()
    const rows = this.unwrap(
      await supabase.from('applications').select('*').eq('user_id', userId),
      'load your applications',
    ) as ApplicationRow[] | null
    return (rows ?? []).map((row) => row.data)
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

  /**
   * Streams cross-device changes to the current user's applications. `onUpsert` fires for
   * INSERT/UPDATE, `onDelete` for DELETE. Returns an unsubscribe function.
   */
  subscribeToApplications(handlers: {
    onUpsert: (application: Application) => void
    onDelete: (id: string) => void
  }): () => void {
    return this.subscribeToOwnedTable<Application>('applications', (change) => {
      if (change.type === 'upsert') handlers.onUpsert(change.row)
      else handlers.onDelete(change.id)
    })
  }
}

/** Shared singleton — import this from stores. The class is exported for testing/DI. */
export const applicationRepository = new ApplicationRepository()
