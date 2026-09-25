// Never import `@octant/email` here: it is server-only and would ship Resend and API-key risk to the browser.
// The send-email Edge Function takes only `{ intent }` and reads the recipient from the verified JWT.

import { supabase } from '@/services/supabase/client'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'

const SEND_EMAIL_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/send-email`

/** Must match the Edge Function's allowlist. */
export const EmailIntent = {
  Welcome: 'welcome',
  PasswordChanged: 'password-changed',
  SecurityAlert: 'security-alert',
} as const

export type EmailIntentValue = (typeof EmailIntent)[keyof typeof EmailIntent]

interface SendEmailRequest {
  intent: EmailIntentValue
}

// Never throws: these emails are side effects of an action that already succeeded; failures land in `email_log`.
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

/** Safe to call on every sign-in: the server de-duplicates per user id. */
export function sendWelcomeEmail(): Promise<boolean> {
  return requestEmail({ intent: EmailIntent.Welcome })
}

/** Call only after the password update succeeded. */
export function sendPasswordChangedEmail(): Promise<boolean> {
  return requestEmail({ intent: EmailIntent.PasswordChanged })
}

/** Sends a new-device security alert to the account's own address. */
export function sendSecurityAlertEmail(): Promise<boolean> {
  return requestEmail({ intent: EmailIntent.SecurityAlert })
}
