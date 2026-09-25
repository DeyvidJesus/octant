// Preview helpers for the React Email dev server; `withPreview` types the `PreviewProps` static once.

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
