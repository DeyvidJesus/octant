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

/**
 * Shared plumbing for all repositories: session resolution and uniform error translation.
 * Concrete repositories own their table names and row mapping; they never leak the raw
 * Supabase client or its error types to callers.
 */
export abstract class BaseRepository {
  /**
   * Resolves the signed-in user's id from the in-memory session mirror — synchronous, with no
   * network call. Every query is RLS-scoped to it, so a missing session is an error rather than
   * an empty result. The mirror is kept current by `AuthContext` via `onAuthStateChange`.
   */
  protected requireUserId(): string {
    const userId = getSessionUserId()
    if (!userId) {
      throw new UnauthenticatedError()
    }
    return userId
  }

  /**
   * Unwraps a Supabase result, converting any `PostgrestError` into a `RepositoryError`.
   * `action` is a short human phrase completing "Could not <action>." for the message.
   */
  protected unwrap<T>(result: SupabaseResult<T>, action: string): T {
    if (result.error) {
      throw new RepositoryError(`Could not ${action}. ${result.error.message}`.trim(), {
        code: result.error.code,
        cause: result.error,
      })
    }
    return result.data
  }

  /**
   * Subscribes to INSERT/UPDATE/DELETE on a `{ id, user_id, data }` table for the current user and
   * dispatches normalized {@link RealtimeChange} events. Returns an unsubscribe function. A no-op
   * (returns an empty teardown) when there is no active session.
   *
   * The subscription is scoped to `user_id` both by the channel filter and by RLS. Deletes rely on
   * REPLICA IDENTITY FULL (migration 0004) so the old row carries `user_id` for the filter to match.
   */
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
