/**
 * Brand identity — the single source of truth for the product's name and public addresses.
 *
 * Before this existed, the product name was hardcoded in six places and had already drifted into two
 * spellings — one in the chrome and login screen, another in prose and onboarding. Every user-visible
 * occurrence now reads from here, so a rename is one edit.
 *
 * Deliberately NOT exported to the email package: `packages/email/src/brand/tokens.ts` and its
 * `EMAIL_CONFIG_DEFAULTS` mirror these values instead. The email layer is server-only and must stay
 * importable from a Deno Edge Function with no dependency on `src/`, and its name is overridable per
 * environment via `EMAIL_APP_NAME`. The two are kept in sync by hand — a short, stable list.
 */

/** Product name, as shown to users. */
export const APP_NAME = 'Octant'

/** Public domain, without a scheme. */
export const APP_DOMAIN = 'useoctant.com'

/** Where support email goes. Matches `EMAIL_SUPPORT` in the Edge Function environment. */
export const SUPPORT_EMAIL = `support@${APP_DOMAIN}`

/**
 * Storage key prefix for local persistence.
 *
 * Intentionally still `careeros:` — see `src/types/backup.ts`. These keys address data already sitting
 * in real users' browsers, and renaming them would orphan every existing local backup. A cosmetic
 * rebrand is not a reason to break stored data.
 */
export const STORAGE_PREFIX = 'careeros'
