/**
 * Preview plumbing for the React Email dev server (`yarn email:dev`).
 *
 * The CLI renders each template file and reads sample props off a `PreviewProps` static. Attaching that
 * static directly trips TypeScript (a function type has no such property), so `withPreview` does the
 * cast once, in a typed way, instead of every template reaching for `any`.
 *
 * `previewBrand` is the shared brand context for previews — it keeps sample data out of the templates
 * themselves, so nothing in a template's body has a development-only default.
 */

import type { ReactElement } from 'react'
import type { EmailBrandContext } from './props.ts'

export const previewBrand: EmailBrandContext = {
  appName: 'Octant',
  appUrl: 'https://app.useoctant.com',
  supportEmail: 'support@useoctant.com',
  preferencesUrl: 'https://app.useoctant.com/settings?prefs=preview-token',
}

export type PreviewableComponent<P> = ((props: P) => ReactElement) & { PreviewProps: P }

/** Attaches sample props to a template component for the React Email dev server. */
export function withPreview<P>(component: (props: P) => ReactElement, previewProps: P): PreviewableComponent<P> {
  const previewable = component as PreviewableComponent<P>
  previewable.PreviewProps = previewProps
  return previewable
}
