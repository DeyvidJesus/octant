// Product name and public addresses. `packages/email` mirrors these by hand because it must not import `src/`.

/** Product name, as shown to users. */
export const APP_NAME = 'Octant'

/** Public domain, without a scheme. */
export const APP_DOMAIN = 'useoctant.com'

/** Matches `EMAIL_SUPPORT` in the Edge Function environment. */
export const SUPPORT_EMAIL = `support@${APP_DOMAIN}`

/** Still `careeros`: renaming it would orphan data already stored in users' browsers. */
export const STORAGE_PREFIX = 'careeros'
