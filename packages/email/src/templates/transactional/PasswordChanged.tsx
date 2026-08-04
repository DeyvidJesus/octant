/**
 * Password Changed — confirmation after a successful password update.
 *
 * Sent even though the user just did it deliberately: if they didn't, this email is the only signal they
 * will get, and it arrives while the reset link they need is still usable.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { urlsFor } from '../../brand/urls.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { Callout } from '../components/Callout.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function PasswordChanged({
  name,
  occurredAt,
  ipAddress,
  userAgent,
  location,
  resetUrl,
  brand,
}: TemplateComponentProps<'password-changed'>) {
  const urls = urlsFor(brand)
  return (
    <BaseLayout preview={`Your ${brand.appName} password was changed.`} brand={brand}>
      <EmailHeading>Your password was changed</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        The password on your {brand.appName} account was updated successfully. All other sessions were
        signed out.
      </Paragraph>

      <InfoTable
        rows={[
          { label: 'When', value: occurredAt },
          { label: 'IP address', value: ipAddress },
          { label: 'Location', value: location },
          { label: 'Device', value: userAgent },
        ]}
      />

      <Callout tone="warning" title="Wasn't you?">
        Someone else may know your credentials. Reset the password immediately and review the devices
        signed in to your account.
      </Callout>

      <Section style={{ padding: `${spacing.xs} 0 0` }}>
        <ActionButton href={resetUrl ?? urls.forgotPassword} variant="danger">
          Reset my password
        </ActionButton>
      </Section>
    </BaseLayout>
  )
}

const PasswordChangedPreview = withPreview(PasswordChanged, {
  name: 'Ana',
  occurredAt: '4 Aug 2026 at 14:32 UTC',
  ipAddress: '203.0.113.42',
  location: 'São Paulo, BR',
  userAgent: 'Chrome on macOS',
  brand: previewBrand,
})

export default PasswordChangedPreview
