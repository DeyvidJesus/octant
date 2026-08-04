/**
 * Email Changed — serves BOTH halves of an address change:
 *
 *   • `confirmUrl` present  → the confirmation sent to the NEW address (Supabase's `email_change`).
 *   • `confirmUrl` absent   → the courtesy notice sent to the OLD address, which is the half that
 *                             actually catches an account takeover. Whoever still controls the previous
 *                             inbox is the only person who can notice an unauthorised change.
 *
 * One template, because everything except the CTA and one sentence is shared.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { urlsFor } from '../../brand/urls.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { Callout } from '../components/Callout.tsx'
import { FallbackLink } from '../components/FallbackLink.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function EmailChanged({
  name,
  newEmail,
  oldEmail,
  confirmUrl,
  occurredAt,
  ipAddress,
  userAgent,
  location,
  brand,
}: TemplateComponentProps<'email-changed'>) {
  const urls = urlsFor(brand)
  const isConfirmation = confirmUrl !== undefined

  return (
    <BaseLayout
      preview={
        isConfirmation
          ? `Confirm ${newEmail} as your new ${brand.appName} email.`
          : `Your ${brand.appName} email address was changed.`
      }
      brand={brand}
    >
      <EmailHeading>{isConfirmation ? 'Confirm your new email' : 'Your email address changed'}</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        {isConfirmation
          ? `Confirm this address to start using it to sign in to ${brand.appName}.`
          : `The email address on your ${brand.appName} account was changed. Sign in with the new address from now on.`}
      </Paragraph>

      <InfoTable
        rows={[
          { label: 'Previous address', value: oldEmail },
          { label: 'New address', value: newEmail },
          { label: 'When', value: occurredAt },
          { label: 'IP address', value: ipAddress },
          { label: 'Location', value: location },
          { label: 'Device', value: userAgent },
        ]}
      />

      {isConfirmation ? (
        <>
          <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
            <ActionButton href={confirmUrl}>Confirm this address</ActionButton>
          </Section>
          <FallbackLink url={confirmUrl} />
          <Paragraph tone="muted">
            Until you confirm, your old address stays active and nothing changes.
          </Paragraph>
        </>
      ) : (
        <>
          <Callout tone="danger" title="Didn't make this change?">
            Someone else may have access to your account. Reset your password now — you'll be able to
            recover the account from this address.
          </Callout>
          <Section style={{ padding: `${spacing.xs} 0 0` }}>
            <ActionButton href={urls.forgotPassword} variant="danger">
              Reset my password
            </ActionButton>
          </Section>
        </>
      )}
    </BaseLayout>
  )
}

const EmailChangedPreview = withPreview(EmailChanged, {
  name: 'Ana',
  newEmail: 'ana.souza@example.com',
  oldEmail: 'ana@example.com',
  confirmUrl: 'https://app.useoctant.com/auth/callback?token_hash=preview&type=email_change',
  occurredAt: '4 Aug 2026 at 14:32 UTC',
  ipAddress: '203.0.113.42',
  location: 'São Paulo, BR',
  userAgent: 'Chrome on macOS',
  brand: previewBrand,
})

export default EmailChangedPreview
