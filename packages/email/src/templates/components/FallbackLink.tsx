/**
 * The "button not working?" block that follows every action CTA.
 *
 * Factored out because six templates need it verbatim — repeating the sentence and the `TokenBlock` in
 * each one is exactly the duplication this package exists to avoid. Optionally renders the raw token
 * too, for clients that rewrite URLs so aggressively the link itself is unusable.
 */

import { Paragraph } from './typography.tsx'
import { TokenBlock } from './TokenBlock.tsx'

export interface FallbackLinkProps {
  url: string
  /** One-time code, shown as a second fallback when the provider supplies one. */
  token?: string
  /** Overrides the default lead-in sentence. */
  label?: string
}

export function FallbackLink({ url, token, label }: FallbackLinkProps) {
  return (
    <>
      <Paragraph tone="muted">
        {label ?? "If the button doesn't work, copy and paste this link into your browser:"}
      </Paragraph>
      <TokenBlock value={url} href={url} emphasis="url" />
      {token !== undefined && (
        <>
          <Paragraph tone="muted">Or enter this code manually:</Paragraph>
          <TokenBlock value={token} emphasis="code" />
        </>
      )}
    </>
  )
}
