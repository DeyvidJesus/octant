import { UnauthenticatedError } from '@/repositories/errors'
import { useToastStore } from './toastStore'

interface PersistOptions {
  /** Re-syncs from the server after a failed write so a rejected optimistic row (e.g. RLS cap) disappears. */
  reconcile?: () => void
}

/** Fire-and-forget write for an optimistic store mutation; on failure it toasts, logs and reconciles. */
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
