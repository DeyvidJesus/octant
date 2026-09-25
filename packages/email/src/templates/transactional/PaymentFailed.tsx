// `invoice.payment_failed`: the CTA is updating the card; the decline reason is shown when Stripe gives one.

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { urlsFor } from '../../brand/urls.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { Callout } from '../components/Callout.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { greetingFor, pluralize } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function PaymentFailed({
  name,
  amountFormatted,
  reason,
  nextAttemptOn,
  gracePeriodDays,
  brand,
}: TemplateComponentProps<'payment-failed'>) {
  const urls = urlsFor(brand)
  return (
    <BaseLayout preview={`We couldn't process your ${brand.appName} payment.`} brand={brand}>
      <EmailHeading>Your payment didn't go through</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        We tried to charge your card for your {brand.appName} subscription and it was declined. Updating
        your payment method takes about a minute and keeps your plan active.
      </Paragraph>

      <InfoTable
        rows={[
          { label: 'Amount due', value: amountFormatted },
          { label: 'Reason', value: reason },
          { label: 'Next attempt', value: nextAttemptOn },
        ]}
      />

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={urls.billing} variant="danger">
          Update payment method
        </ActionButton>
      </Section>

      <Callout tone="warning" title="What happens next">
        {gracePeriodDays !== undefined && gracePeriodDays > 0
          ? `We'll retry automatically. If it still fails after ${pluralize(gracePeriodDays, 'day')}, your account moves to the free plan — your data is kept either way.`
          : "We'll retry automatically. If it keeps failing, your account moves to the free plan — your data is kept either way."}
      </Callout>
    </BaseLayout>
  )
}

const PaymentFailedPreview = withPreview(PaymentFailed, {
  name: 'Ana',
  amountFormatted: 'R$ 49,00',
  reason: 'Your card was declined (insufficient funds)',
  nextAttemptOn: '7 Aug 2026',
  gracePeriodDays: 7,
  brand: previewBrand,
})

export default PaymentFailedPreview
