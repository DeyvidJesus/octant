/**
 * Trial Expired — the trial ended without a payment method, so the account is back on the free plan.
 *
 * Same caveat as TrialEnding: trials don't exist in the product yet, so nothing triggers this. The
 * webhook branch that would fire it (a `customer.subscription.updated` leaving `trialing`) is wired and
 * tested, and starts working the moment `trial_period_days` is set at checkout.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { urlsFor } from '../../brand/urls.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { EmailHeading, Label, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function TrialExpired({ name, planName, brand }: TemplateComponentProps<'trial-expired'>) {
  const urls = urlsFor(brand)
  return (
    <BaseLayout preview={`Your ${brand.appName} trial has ended.`} brand={brand}>
      <EmailHeading>Your trial has ended</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Your {planName} trial is over and your account is now on the free plan. Everything you built is
        still there — nothing was deleted.
      </Paragraph>

      <Label>On the free plan</Label>
      <InfoTable
        rows={[
          { label: 'Existing data', value: 'Fully available' },
          { label: 'New job opportunities', value: 'Up to 3' },
          { label: 'New tailored résumés', value: '1' },
          { label: 'Discovery cadence', value: 'Daily' },
        ]}
      />

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={urls.billing}>Upgrade to {planName}</ActionButton>
      </Section>

      <Paragraph tone="muted">
        Upgrade whenever you like — the limits lift immediately and nothing needs re-doing.
      </Paragraph>
    </BaseLayout>
  )
}

const TrialExpiredPreview = withPreview(TrialExpired, { name: 'Ana', planName: 'Pro', brand: previewBrand })

export default TrialExpiredPreview
