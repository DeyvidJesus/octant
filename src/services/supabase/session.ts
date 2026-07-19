/**
 * In-memory mirror of the current auth session's user id.
 *
 * `supabase.auth.getUser()` performs a NETWORK round-trip to the GoTrue auth server on every
 * call (it re-validates the JWT). Calling it before every write turned each rapid user action
 * into N auth requests. Instead, `AuthContext` pushes the user id here once per auth-state change
 * (initial session, login, logout, token refresh) via `onAuthStateChange`, and the repository
 * layer reads it synchronously — no network, no storage access on the write path.
 *
 * This is intentionally framework-agnostic (plain module state) so both React context and the
 * non-React repository layer can share it.
 */
let currentUserId: string | null = null

/** Set by the auth listener whenever the session changes. Pass `null` on sign-out. */
export function setSessionUserId(userId: string | null): void {
  currentUserId = userId
}

/** The signed-in user's id, or `null` if there is no active session. Synchronous, no I/O. */
export function getSessionUserId(): string | null {
  return currentUserId
}
