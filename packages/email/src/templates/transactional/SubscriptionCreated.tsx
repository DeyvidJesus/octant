// `customer.subscription.created`: what the plan unlocks, kept separate from the BillingSuccess receipt.

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

export function SubscriptionCreated({
  name,
  planName,
  amountFormatted,
  interval,
  renewsOn,
  brand,
}: TemplateComponentProps<'subscription-created'>) {
  const urls = urlsFor(brand)
  const price =
    amountFormatted !== undefined && interval !== undefined
      ? `${amountFormatted} / ${interval}`
      : amountFormatted

  return (
    <BaseLayout preview={`Your ${brand.appName} ${planName} plan is live.`} brand={brand}>
      <EmailHeading>You're on {planName}</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Your {planName} subscription is active. The limits are gone — add as many roles as you like and
        generate a tailored résumé for every one of them.
      </Paragraph>

      <Label>What's included</Label>
      <InfoTable
        rows={[
          { label: 'Job opportunities', value: 'Unlimited' },
          { label: 'Tailored résumés', value: 'Unlimited' },
          { label: 'Discovery cadence', value: 'Hourly instead of daily' },
        ]}
      />

      <Label>Your plan</Label>
      <InfoTable
        rows={[
          { label: 'Plan', value: planName },
          { label: 'Price', value: price },
          { label: 'Renews', value: renewsOn },
        ]}
      />

      <Section style={{ padding: `${spacing.xs} 0 0` }}>
        <ActionButton href={urls.dashboard}>Start using {planName}</ActionButton>
      </Section>

      <Paragraph tone="muted">
        You can review or cancel your subscription any time from{' '}
        {/* Plain-text output keeps the URL, so this reads sensibly without the link. */}
        billing settings: {urls.billing}
      </Paragraph>
    </BaseLayout>
  )
}

const SubscriptionCreatedPreview = withPreview(SubscriptionCreated, {
  name: 'Ana',
  planName: 'Pro',
  amountFormatted: 'R$ 49,00',
  interval: 'month',
  renewsOn: '3 Sep 2026',
  brand: previewBrand,
})

export default SubscriptionCreatedPreview
