// In-memory user id set by AuthContext on each auth change, so writes avoid the network call in `getUser()`.
let currentUserId: string | null = null

/** Set by the auth listener whenever the session changes. Pass `null` on sign-out. */
export function setSessionUserId(userId: string | null): void {
  currentUserId = userId
}

/** The signed-in user's id, or `null` if there is no active session. Synchronous, no I/O. */
export function getSessionUserId(): string | null {
  return currentUserId
}
