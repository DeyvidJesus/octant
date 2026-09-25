import { supabase } from './client'

// Email-triggering auth calls. Redirect URLs live here so email links never dead-end on GoTrue's default.
// These throw on failure; callers surface `err.message`.

function origin(): string {
  return window.location.origin.replace(/\/+$/, '')
}

/** Landing route for verification, magic-link and invite links. */
export function authCallbackUrl(): string {
  return `${origin()}/auth/callback`
}

/** Landing route for password-recovery links, which need a "new password" form. */
export function passwordResetUrl(): string {
  return `${origin()}/reset-password`
}

/** The resulting auth-state change makes AuthContext wipe every store. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** `hasSession` is false while email confirmation is pending; `name` lets email templates greet the user. */
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

/** The UI must not reveal whether the address exists, or this becomes an account-enumeration oracle. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: passwordResetUrl() })
  if (error) throw error
}

// `otp_disabled` is what GoTrue returns for an unknown address when `shouldCreateUser` is false.
const ADDRESS_UNKNOWN_CODES = new Set(['otp_disabled', 'user_not_found'])

// Swallowing these keeps magic-link and resend requests non-enumerable.
function isAddressUnknown(error: { code?: string; message?: string } | null): boolean {
  if (error === null) return false
  if (error.code !== undefined && ADDRESS_UNKNOWN_CODES.has(error.code)) return true
  // Older GoTrue builds send the message without a machine-readable code.
  return /signups not allowed for otp|user not found/i.test(error.message ?? '')
}

/** Passwordless sign-in; an unknown address silently succeeds so accounts can't be enumerated. */
export async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authCallbackUrl(), shouldCreateUser: false },
  })
  if (error && !isAddressUnknown(error)) throw error
}

/** Re-sends the signup confirmation; an unknown address silently succeeds. */
export async function resendVerification(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: authCallbackUrl() },
  })
  if (error && !isAddressUnknown(error)) throw error
}

/** Also completes password recovery. The caller sends the "password changed" notice only on success. */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

/** Supabase emails the new address (and the current one if secure email change is on). */
export async function changeEmail(newEmail: string): Promise<void> {
  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: authCallbackUrl() },
  )
  if (error) throw error
}
