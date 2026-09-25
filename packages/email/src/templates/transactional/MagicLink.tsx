// Passwordless sign-in (`magiclink`); the single-use warning matters because the link is a credential.

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { Callout } from '../components/Callout.tsx'
import { FallbackLink } from '../components/FallbackLink.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { expiryNote, greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function MagicLink({
  name,
  magicLinkUrl,
  token,
  expiresInMinutes,
  brand,
}: TemplateComponentProps<'magic-link'>) {
  const expiry = expiryNote(expiresInMinutes)
  return (
    <BaseLayout preview={`Your sign-in link for ${brand.appName}.`} brand={brand}>
      <EmailHeading>Sign in to {brand.appName}</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>No password needed — this link signs you straight in.</Paragraph>

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={magicLinkUrl}>Sign in</ActionButton>
      </Section>

      {expiry !== undefined && <Paragraph tone="muted">{expiry}</Paragraph>}

      <FallbackLink url={magicLinkUrl} token={token} />

      <Callout tone="info" title="Keep this link private">
        Anyone with this link can sign in as you until it expires or is used. Don't forward this email.
      </Callout>
    </BaseLayout>
  )
}

const MagicLinkPreview = withPreview(MagicLink, {
  name: 'Ana',
  magicLinkUrl: 'https://app.useoctant.com/auth/callback?token_hash=preview&type=magiclink',
  token: '739104',
  expiresInMinutes: 15,
  brand: previewBrand,
})

export default MagicLinkPreview
