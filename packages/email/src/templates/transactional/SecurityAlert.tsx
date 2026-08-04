/**
 * Security Alert — new sign-in, new device, suspicious activity, or a reauthentication code.
 *
 * One template covers all four because the body is identical apart from the headline and the lead
 * sentence; only the reauthentication case adds a code block. Splitting it into four files would
 * duplicate the metadata table and the "secure your account" advice four times.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { Callout } from '../components/Callout.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { TokenBlock } from '../components/TokenBlock.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { urlsFor } from '../../brand/urls.ts'
import { greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import { SecurityAlertKind, type SecurityAlertKindValue, type TemplateComponentProps } from '../props.ts'

/** Headline + lead copy per alert kind. Keeps the JSX free of a four-branch conditional. */
const COPY: Record<SecurityAlertKindValue, { heading: string; lead: string }> = {
  [SecurityAlertKind.NewSignIn]: {
    heading: 'New sign-in to your account',
    lead: 'Your account was just signed in to. If that was you, nothing more is needed.',
  },
  [SecurityAlertKind.NewDevice]: {
    heading: 'A new device signed in',
    lead: 'Your account was signed in to from a device we haven’t seen before.',
  },
  [SecurityAlertKind.SuspiciousActivity]: {
    heading: 'Unusual activity on your account',
    lead: 'We noticed activity that doesn’t match your usual pattern and wanted you to know right away.',
  },
  [SecurityAlertKind.Reauthentication]: {
    heading: 'Confirm it’s you',
    lead: 'Enter the code below to confirm this sensitive change.',
  },
}

export function SecurityAlert({
  name,
  kind,
  code,
  occurredAt,
  ipAddress,
  userAgent,
  location,
  secureAccountUrl,
  brand,
}: TemplateComponentProps<'security-alert'>) {
  const urls = urlsFor(brand)
  const copy = COPY[kind]
  const isReauth = kind === SecurityAlertKind.Reauthentication
  const tone = kind === SecurityAlertKind.SuspiciousActivity ? 'danger' : 'warning'

  return (
    <BaseLayout preview={`${copy.heading} — ${brand.appName}`} brand={brand}>
      <EmailHeading>{copy.heading}</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>{copy.lead}</Paragraph>

      {isReauth && code !== undefined && <TokenBlock value={code} emphasis="code" />}

      <InfoTable
        rows={[
          { label: 'When', value: occurredAt },
          { label: 'IP address', value: ipAddress },
          { label: 'Location', value: location },
          { label: 'Device', value: userAgent },
        ]}
      />

      {!isReauth && (
        <>
          <Callout tone={tone} title="If this wasn't you">
            Change your password immediately. That signs out every other session and invalidates any
            outstanding reset links.
          </Callout>
          <Section style={{ padding: `${spacing.xs} 0 0` }}>
            <ActionButton href={secureAccountUrl ?? urls.security} variant="danger">
              Secure my account
            </ActionButton>
          </Section>
        </>
      )}

      {isReauth && (
        <Paragraph tone="muted">
          If you didn't start this, don't enter the code — and change your password as a precaution.
        </Paragraph>
      )}
    </BaseLayout>
  )
}

const SecurityAlertPreview = withPreview(SecurityAlert, {
  name: 'Ana',
  kind: SecurityAlertKind.NewDevice,
  occurredAt: '4 Aug 2026 at 14:32 UTC',
  ipAddress: '203.0.113.42',
  location: 'São Paulo, BR',
  userAgent: 'Safari on iPhone',
  brand: previewBrand,
})

export default SecurityAlertPreview
