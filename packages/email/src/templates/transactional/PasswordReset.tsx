// Supabase `recovery` action; shows request IP, device and time so the recipient can judge "was this you?".

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { Callout } from '../components/Callout.tsx'
import { FallbackLink } from '../components/FallbackLink.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { expiryNote, greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function PasswordReset({
  name,
  resetUrl,
  token,
  expiresInMinutes,
  occurredAt,
  ipAddress,
  userAgent,
  location,
  brand,
}: TemplateComponentProps<'password-reset'>) {
  const expiry = expiryNote(expiresInMinutes)
  return (
    <BaseLayout preview={`Reset your ${brand.appName} password.`} brand={brand}>
      <EmailHeading>Reset your password</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Someone asked to reset the password for your {brand.appName} account. Use the button below to
        choose a new one.
      </Paragraph>

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={resetUrl}>Choose a new password</ActionButton>
      </Section>

      {expiry !== undefined && <Paragraph tone="muted">{expiry}</Paragraph>}

      <InfoTable
        rows={[
          { label: 'Requested', value: occurredAt },
          { label: 'IP address', value: ipAddress },
          { label: 'Location', value: location },
          { label: 'Device', value: userAgent },
        ]}
      />

      <FallbackLink url={resetUrl} token={token} />

      <Callout tone="warning" title="Didn't request this?">
        Your password hasn't changed and this link will expire on its own. If you'd like to be certain,
        sign in and change your password — that invalidates every outstanding reset link.
      </Callout>
    </BaseLayout>
  )
}

const PasswordResetPreview = withPreview(PasswordReset, {
  name: 'Ana',
  resetUrl: 'https://app.useoctant.com/reset-password?token_hash=preview&type=recovery',
  token: '204817',
  expiresInMinutes: 60,
  occurredAt: '4 Aug 2026 at 14:32 UTC',
  ipAddress: '203.0.113.42',
  location: 'São Paulo, BR',
  userAgent: 'Chrome on macOS',
  brand: previewBrand,
})

export default PasswordResetPreview
