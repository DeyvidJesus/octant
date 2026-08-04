/**
 * Billing Success — the receipt for a paid invoice (`invoice.payment_succeeded`).
 *
 * Money amounts and dates arrive pre-formatted; this template never does currency or locale maths, so
 * there's no second formatting implementation to drift from the app's own.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { urlsFor } from '../../brand/urls.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function BillingSuccess({
  name,
  planName,
  amountFormatted,
  invoiceNumber,
  invoiceUrl,
  periodEnd,
  brand,
}: TemplateComponentProps<'billing-success'>) {
  const urls = urlsFor(brand)
  return (
    <BaseLayout preview={`Payment received — ${amountFormatted} for ${brand.appName} ${planName}.`} brand={brand}>
      <EmailHeading>Payment received</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Thanks — we've received your payment and your {planName} plan is active.
      </Paragraph>

      <InfoTable
        rows={[
          { label: 'Plan', value: planName },
          { label: 'Amount', value: amountFormatted },
          { label: 'Invoice', value: invoiceNumber },
          { label: 'Paid through', value: periodEnd },
        ]}
      />

      <Section style={{ padding: `${spacing.xs} 0 0` }}>
        <ActionButton href={invoiceUrl ?? urls.billing} variant={invoiceUrl !== undefined ? 'primary' : 'neutral'}>
          {invoiceUrl !== undefined ? 'View receipt' : 'Manage billing'}
        </ActionButton>
      </Section>
    </BaseLayout>
  )
}

const BillingSuccessPreview = withPreview(BillingSuccess, {
  name: 'Ana',
  planName: 'Pro',
  amountFormatted: 'R$ 49,00',
  invoiceNumber: 'B1C2D3-0007',
  invoiceUrl: 'https://invoice.stripe.com/i/preview',
  periodEnd: '3 Sep 2026',
  brand: previewBrand,
})

export default BillingSuccessPreview
