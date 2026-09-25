import posthog from 'posthog-js'

// PostHog analytics. Every function is a no-op without `VITE_POSTHOG_KEY`; autocapture is off.

/** Use these constants rather than raw strings. */
export const AnalyticsEvent = {
  JobAdded: 'job_added',
  JobAnalyzed: 'job_analyzed',
  ResumeGenerated: 'resume_generated',
  ApplicationCreated: 'application_created',
  JobApplied: 'job_applied',
  UpgradeStarted: 'upgrade_started',
  DiscoveryRunStarted: 'discovery_run_started',
  DiscoveryRunCompleted: 'discovery_run_completed',
  // `email_requested` means the client asked for a send; delivery status is in `public.email_log`.
  EmailRequested: 'email_requested',
  PasswordResetRequested: 'password_reset_requested',
  MagicLinkRequested: 'magic_link_requested',
  VerificationResent: 'verification_resent',
} as const

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]

let initialized = false

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key || initialized) return
  posthog.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    capture_pageview: true,
    autocapture: false,
  })
  initialized = true
}

/** Ties subsequent events to the signed-in user. */
export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  if (!initialized) return
  posthog.identify(userId, properties)
}

/** Clears identity on sign-out so the next user isn't merged into the previous one. */
export function resetAnalytics(): void {
  if (!initialized) return
  posthog.reset()
}

export function trackEvent(event: AnalyticsEventName, properties?: Record<string, unknown>): void {
  if (!initialized) return
  posthog.capture(event, properties)
}
