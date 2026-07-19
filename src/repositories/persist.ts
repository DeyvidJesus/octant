import { UnauthenticatedError } from './errors'

/**
 * Runs a fire-and-forget persistence action for an optimistic store mutation.
 *
 * Store mutators update in-memory state synchronously and return `void`; the write to the
 * backend happens here, out of band, so the UI never blocks on the network. Failures are
 * logged at this single boundary instead of surfacing as unhandled promise rejections.
 *
 * This is the deliberate seam where error surfacing (toasts), optimistic rollback, and
 * offline queueing will hook in during later phases.
 */
export function persist(action: () => Promise<unknown>, context: string): void {
  action().catch((error) => {
    // A missing session simply means there is nothing to sync yet (e.g. pre-login local state).
    if (error instanceof UnauthenticatedError) return
    console.error(`[persist] ${context} failed`, error)
  })
}
