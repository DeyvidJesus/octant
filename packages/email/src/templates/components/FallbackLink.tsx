// "Button not working?" block after each CTA: the raw link, plus the one-time code when there is one.

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
