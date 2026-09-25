import type { PostgrestError, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase/client'
import type { ZodType } from 'zod'
import { getSessionUserId } from '@/services/supabase/session'
import { Sentry } from '@/services/monitoring/sentry'
import { RepositoryError, UnauthenticatedError } from './errors'
import { parseDocuments } from './schemas'

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

  /** Validates JSONB documents read from `table`: repaired ones are returned, invalid ones reported and dropped. */
  protected parseRows<T>(docs: unknown[] | null | undefined, schema: ZodType, table: string): T[] {
    const { valid, rejected } = parseDocuments<T>(docs ?? [], schema)
    if (rejected.length > 0) {
      console.warn(`[repository] dropped ${rejected.length} invalid row(s) from ${table}`, rejected)
      Sentry.captureMessage(`Invalid JSONB rows in ${table}`, { level: 'warning', extra: { rejected } })
    }
    return valid
  }

  /** Streams changes to a `{ id, user_id, data }` table for the current user; no-op without a session. */
  // DELETE events only match the user_id filter because the table uses REPLICA IDENTITY FULL.
  protected subscribeToOwnedTable<T>(
    table: string,
    schema: ZodType,
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
          const [doc] = this.parseRows<T>(payload.new?.data ? [payload.new.data] : [], schema, table)
          if (doc) onChange({ type: 'upsert', row: doc })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }
}
