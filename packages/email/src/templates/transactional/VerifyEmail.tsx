/**
 * Verify Email — the address-confirmation step of signup.
 *
 * Driven by Supabase Auth's Send Email Hook (`email_action_type: 'signup'`), which supplies the
 * `token_hash` the verify URL is built from.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { FallbackLink } from '../components/FallbackLink.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { expiryNote, greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function VerifyEmail({
  name,
  verifyUrl,
  token,
  expiresInMinutes,
  brand,
}: TemplateComponentProps<'verify-email'>) {
  const expiry = expiryNote(expiresInMinutes)
  return (
    <BaseLayout preview={`Confirm your email to finish setting up ${brand.appName}.`} brand={brand}>
      <EmailHeading>Confirm your email</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Confirm this address to activate your {brand.appName} account. It takes one click.
      </Paragraph>

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={verifyUrl}>Confirm email address</ActionButton>
      </Section>

      {expiry !== undefined && <Paragraph tone="muted">{expiry}</Paragraph>}

      <FallbackLink url={verifyUrl} token={token} />

      <Paragraph tone="muted">
        If you didn't create an account, you can ignore this email — nothing was set up.
      </Paragraph>
    </BaseLayout>
  )
}

const VerifyEmailPreview = withPreview(VerifyEmail, {
  name: 'Ana',
  verifyUrl: 'https://app.useoctant.com/auth/callback?token_hash=preview&type=signup',
  token: '481920',
  expiresInMinutes: 60,
  brand: previewBrand,
})

export default VerifyEmailPreview
