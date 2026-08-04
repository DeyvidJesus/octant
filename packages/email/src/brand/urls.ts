/**
 * Link builders.
 *
 * Every URL an email can contain is produced here, from the single `appUrl` in `EmailConfig`. Templates
 * never concatenate paths themselves, so a change to a route is a one-line change and there is no risk
 * of a template shipping a relative link (which is dead in an email client).
 *
 * The route names mirror `src/app/routes.tsx`.
 */

import type { EmailBrandContext } from '../templates/props.ts'

export interface EmailUrls {
  dashboard: string
  settings: string
  billing: string
  security: string
  login: string
  forgotPassword: string
  /** Notification preferences for one recipient; requires an unsubscribe token. */
  preferences: (token: string) => string
  /** Escape hatch for any other in-app destination. */
  path: (path: string) => string
}

/** Joins an origin and a path with exactly one slash. */
function join(origin: string, path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${origin.replace(/\/+$/, '')}${suffix}`
}

export function createUrls(appUrl: string): EmailUrls {
  return {
    dashboard: join(appUrl, '/'),
    settings: join(appUrl, '/settings'),
    // The plan card lives on the settings page; keep the deep link honest rather than inventing a route.
    billing: join(appUrl, '/settings?tab=plan'),
    security: join(appUrl, '/settings?tab=security'),
    login: join(appUrl, '/login'),
    forgotPassword: join(appUrl, '/forgot-password'),
    preferences: (token: string) => join(appUrl, `/settings?prefs=${encodeURIComponent(token)}`),
    path: (path: string) => join(appUrl, path),
  }
}

/** Convenience for templates, which always hold a `brand` prop rather than the raw config. */
export function urlsFor(brand: EmailBrandContext): EmailUrls {
  return createUrls(brand.appUrl)
}
