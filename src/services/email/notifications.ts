/**
 * The app's only entry point for triggering an email.
 *
 * IMPORTANT: this file must never import `@octant/email`. That package is server-only — it pulls in the
 * Resend SDK and `react-dom/server`, neither of which belongs in a browser bundle, and it would put an
 * API key one careless `VITE_` away from being shipped to the client. The browser instead asks the
 * `send-email` Edge Function to act, and the function decides what to send and to whom.
 *
 * The wire protocol is deliberately minimal: `{ intent }`, nothing else. The recipient is taken from the
 * verified JWT server-side, so nothing here can address an email to someone else even if it tried.
 *
 * Follows the repo's edge-function convention — a hand-rolled `fetch` with an explicit
 * `Authorization: Bearer`, matching `src/services/billing/pricing.ts`. (`functions.invoke` is used
 * nowhere in this codebase.)
 */

import { supabase } from '@/services/supabase/client'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'

const SEND_EMAIL_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/send-email`

/** The intents the Edge Function accepts. Kept in sync with its own allowlist. */
export const EmailIntent = {
  Welcome: 'welcome',
  PasswordChanged: 'password-changed',
  EmailChangedNotice: 'email-changed-notice',
  SecurityAlert: 'security-alert',
} as const

export type EmailIntentValue = (typeof EmailIntent)[keyof typeof EmailIntent]

interface SendEmailRequest {
  intent: EmailIntentValue
  /** Only honoured for `email-changed-notice`: the address the account just moved away from. */
  previousEmail?: string
}

/**
 * Asks the server to send one transactional email.
 *
 * Returns `true` when the server accepted it. Never throws — every caller is a side-effect on a
 * successful primary action (a signup, a password change), and failing to send a courtesy email must not
 * surface an error over an operation that actually succeeded. The server records the failure in
 * `email_log`, which is the right place to notice it.
 */
async function requestEmail(request: SendEmailRequest): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (token === undefined) return false

    const response = await fetch(SEND_EMAIL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      let detail = ''
      try {
        detail = ((await response.json()) as { error?: string })?.error ?? ''
      } catch {
        /* keep the status-only message */
      }
      console.error(`[email] send-email rejected "${request.intent}". ${detail}`.trim())
      return false
    }

    trackEvent(AnalyticsEvent.EmailRequested, { intent: request.intent })
    return true
  } catch (error) {
    console.error(`[email] could not reach send-email for "${request.intent}"`, error)
    return false
  }
}

/**
 * Sends the welcome email. Safe to call on every sign-in: the server de-duplicates on
 * `email_log.idempotency_key`, which for this intent is derived from the user id alone, so it can only
 * ever be delivered once per account.
 */
export function sendWelcomeEmail(): Promise<boolean> {
  return requestEmail({ intent: EmailIntent.Welcome })
}

/** Notifies the user that their password changed. Call only after the update actually succeeded. */
export function sendPasswordChangedEmail(): Promise<boolean> {
  return requestEmail({ intent: EmailIntent.PasswordChanged })
}

/**
 * Notifies the PREVIOUS address that the account's email was changed — the tripwire for an
 * unauthorised change, since it reaches the inbox the legitimate owner still controls.
 */
export function sendEmailChangedNotice(previousEmail: string): Promise<boolean> {
  return requestEmail({ intent: EmailIntent.EmailChangedNotice, previousEmail })
}

/** Sends a new-device security alert to the account's own address. */
export function sendSecurityAlertEmail(): Promise<boolean> {
  return requestEmail({ intent: EmailIntent.SecurityAlert })
}
