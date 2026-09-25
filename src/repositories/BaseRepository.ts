import type { PostgrestError, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase/client'
import { getSessionUserId } from '@/services/supabase/session'
import { RepositoryError, UnauthenticatedError } from './errors'

/** Minimal shape of a Supabase query/command result the repositories unwrap. */
interface SupabaseResult<T> {
  data: T
  error: PostgrestError | null
}

/** A normalized realtime change dispatched to store listeners. */
export type RealtimeChange<T> =
  | { type: 'upsert'; row: T }
  | { type: 'delete'; id: string }

/** The `{ id, user_id, data }` row shape shared by the realtime-enabled tables. */
interface OwnedRow<T> {
  id: string
  user_id: string
  data: T
}

/** Session resolution and error translation shared by all repositories. Never leaks Supabase types. */
export abstract class BaseRepository {
  /** Reads the user id from the session mirror kept by `AuthContext` (no network call). */
  protected requireUserId(): string {
    const userId = getSessionUserId()
    if (!userId) {
      throw new UnauthenticatedError()
    }
    return userId
  }

  /** Unwraps a Supabase result; `action` completes the message "Could not <action>." */
  protected unwrap<T>(result: SupabaseResult<T>, action: string): T {
    if (result.error) {
      throw new RepositoryError(`Could not ${action}. ${result.error.message}`.trim(), {
        code: result.error.code,
        cause: result.error,
      })
    }
    return result.data
  }

  /** Streams changes to a `{ id, user_id, data }` table for the current user; no-op without a session. */
  // DELETE events only match the user_id filter because the table uses REPLICA IDENTITY FULL.
  protected subscribeToOwnedTable<T>(
    table: string,
    onChange: (change: RealtimeChange<T>) => void,
  ): () => void {
    const userId = getSessionUserId()
    if (!userId) return () => {}

    const channel = supabase
      .channel(`${table}:${userId}`)
      .on<OwnedRow<T>>(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<OwnedRow<T>>) => {
          if (payload.eventType === 'DELETE') {
            const id = payload.old?.id
            if (typeof id === 'string') onChange({ type: 'delete', id })
            return
          }
          const row = payload.new
          if (row?.data) onChange({ type: 'upsert', row: row.data })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }
}
