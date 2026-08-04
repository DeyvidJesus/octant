import { supabase } from './client'

/**
 * Auth operations that trigger email.
 *
 * Every function that produces a link passes an explicit `redirectTo` / `emailRedirectTo`, because the
 * links now land on real routes this app owns (`/auth/callback`, `/reset-password`) rather than on
 * GoTrue's default. Getting that wrong is silent — the email still arrives, but the link dead-ends — so
 * the destinations live here in one place instead of at each call site.
 *
 * These functions THROW on failure, matching the convention in `src/services/billing/*` and the
 * repository layer; callers surface `err.message`.
 */

/** Absolute origin of the running app, used to build the callback URLs the email links point at. */
function origin(): string {
  return window.location.origin.replace(/\/+$/, '')
}

/** Where a verification / magic-link / invite link lands once GoTrue establishes the session. */
export function authCallbackUrl(): string {
  return `${origin()}/auth/callback`
}

/** Where a password-recovery link lands. A dedicated route, since it must show a "new password" form. */
export function passwordResetUrl(): string {
  return `${origin()}/reset-password`
}

/**
 * Signs the user out. The resulting `onAuthStateChange(null)` drives AuthContext to wipe every store
 * (see `resetAllStores`), so no in-memory data is left behind for the next session on this browser.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/**
 * Creates an account. `name` is stored in user metadata so the email templates can greet the person by
 * name — previously nothing was captured at signup, so every email opened with "Hi there,".
 *
 * Returns whether a session was established: with email confirmation enabled there is none until the
 * address is verified, and the caller shows a "check your inbox" notice instead of navigating.
 */
export async function signUp(email: string, password: string, name?: string): Promise<{ hasSession: boolean }> {
  const trimmedName = name?.trim()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authCallbackUrl(),
      data: trimmedName !== undefined && trimmedName !== '' ? { name: trimmedName } : undefined,
    },
  })
  if (error) throw error
  return { hasSession: data.session !== null }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/**
 * Sends a password-reset email.
 *
 * Note that Supabase does NOT reveal whether the address exists, and neither should the caller's UI —
 * a "no such account" message turns this into an account-enumeration oracle.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: passwordResetUrl() })
  if (error) throw error
}

/**
 * GoTrue error codes that mean "that address has no account here".
 *
 * `otp_disabled` is the confusingly-named one: GoTrue returns it (message "Signups not allowed for otp")
 * when a magic link is requested with `shouldCreateUser: false` for an address it doesn't know. It is not
 * about OTP being switched off.
 */
const ADDRESS_UNKNOWN_CODES = new Set(['otp_disabled', 'user_not_found'])

/**
 * True when the failure only tells us the address is unknown.
 *
 * Swallowing these is what keeps the operation non-enumerable. If it were left to each caller, the first
 * one that forgot would turn the form into an account-enumeration oracle — and the UI can't hardcode the
 * check either, because the whole point is that callers cannot distinguish the two outcomes.
 */
function isAddressUnknown(error: { code?: string; message?: string } | null): boolean {
  if (error === null) return false
  if (error.code !== undefined && ADDRESS_UNKNOWN_CODES.has(error.code)) return true
  // Older GoTrue builds send the message without a machine-readable code.
  return /signups not allowed for otp|user not found/i.test(error.message ?? '')
}

/**
 * Sends a passwordless sign-in link.
 *
 * `shouldCreateUser: false` keeps this a sign-in rather than a back-door signup — but that makes GoTrue
 * reject unknown addresses, and surfacing that rejection would reveal exactly which addresses have
 * accounts. So an unknown address resolves successfully and sends nothing: from the outside, requesting a
 * link for a known and an unknown address are indistinguishable.
 *
 * Real failures (rate limits, provider outages, misconfiguration) still throw.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authCallbackUrl(), shouldCreateUser: false },
  })
  if (error && !isAddressUnknown(error)) throw error
}

/**
 * Re-sends the signup confirmation, for when the first one was lost or expired.
 *
 * Same non-enumeration rule as `sendMagicLink`: an unknown address is a silent success.
 */
export async function resendVerification(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  })
  if (error && !isAddressUnknown(error)) throw error
}

/**
 * Sets a new password for the signed-in user (also the second half of the recovery flow, where the
 * recovery link has already established a session).
 *
 * Sending the "your password changed" notice is the CALLER's job via
 * `src/services/email/notifications.ts` — this module stays purely about auth, and the notice must not
 * be sent if the update itself failed.
 */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/**
 * Starts an email change. Supabase sends a confirmation to the new address (and, when "Secure email
 * change" is enabled, a notice to the current one) — both rendered by the `auth-email-hook` function.
 */
export async function changeEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: authCallbackUrl() },
  )
  if (error) throw error
}
