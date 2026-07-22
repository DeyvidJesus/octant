import { UnauthenticatedError } from './errors'
import { useToastStore } from '@/stores/toastStore'

interface PersistOptions {
  /**
   * Reconcile in-memory state with the server after a failed write — typically the store's
   * `_fetchFromSupabase`. Runs on non-auth failures so an optimistic row rejected by the backend
   * (e.g. a free-tier RLS cap) is dropped from the UI instead of lingering until the next reload.
   */
  reconcile?: () => void
}

/**
 * Runs a fire-and-forget persistence action for an optimistic store mutation.
 *
 * Store mutators update in-memory state synchronously and return `void`; the write to the
 * backend happens here, out of band, so the UI never blocks on the network. On failure this single
 * boundary surfaces a toast, logs the error, and (optionally) reconciles the optimistic state.
 */
export function persist(
  action: () => Promise<unknown>,
  context: string,
  options: PersistOptions = {},
): void {
  action().catch((error) => {
    // A missing session simply means there is nothing to sync yet (e.g. pre-login local state).
    if (error instanceof UnauthenticatedError) return
    console.error(`[persist] ${context} failed`, error)
    useToastStore
      .getState()
      .notify('Some changes could not be saved. Check your connection or plan limits and try again.', 'error')
    options.reconcile?.()
  })
}
