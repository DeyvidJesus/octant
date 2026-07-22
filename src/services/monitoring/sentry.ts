import * as Sentry from '@sentry/react'

/**
 * Crash + unhandled-rejection reporting. Env-gated on `VITE_SENTRY_DSN`: with no DSN this is a
 * complete no-op (local dev, tests, CI). `Sentry.init` installs global `error` and
 * `unhandledrejection` handlers, so uncaught frontend crashes and rejected promises are captured
 * automatically; the React `ErrorBoundary` (wired in main.tsx) reports render-time crashes too.
 */
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
