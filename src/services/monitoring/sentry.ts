import * as Sentry from '@sentry/react'

/** Installs global error and unhandled-rejection reporting; a no-op without `VITE_SENTRY_DSN`. */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    // Conservative default for a launch; tune per traffic.
    tracesSampleRate: 0.1,
  })
}

/** Associates errors with the signed-in user (id only — no PII beyond what auth already holds). */
export function setSentryUser(userId: string | null): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  Sentry.setUser(userId ? { id: userId } : null)
}

export { Sentry }
