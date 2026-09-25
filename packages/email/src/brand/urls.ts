// Every link an email contains is built here from `appUrl`, so templates never ship a relative (dead) link.
// Route names mirror `src/app/routes.tsx`.

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
    // The plan card lives on the settings page; there is no separate billing route.
    billing: join(appUrl, '/settings?tab=plan'),
    security: join(appUrl, '/settings?tab=security'),
    login: join(appUrl, '/login'),
    forgotPassword: join(appUrl, '/forgot-password'),
    preferences: (token: string) => join(appUrl, `/settings?prefs=${encodeURIComponent(token)}`),
    path: (path: string) => join(appUrl, path),
  }
}

/** For templates, which hold a `brand` prop rather than the raw config. */
export function urlsFor(brand: EmailBrandContext): EmailUrls {
  return createUrls(brand.appUrl)
}
