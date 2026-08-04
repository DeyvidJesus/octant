/**
 * Subscription Cancelled — `customer.subscription.deleted`.
 *
 * States plainly that the data survives the downgrade. That is both true (the free tier caps CREATION,
 * not reading — see `within_job_limit` in migration 0007) and the single most common fear at cancel time.
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

export function SubscriptionCancelled({
  name,
  planName,
  accessUntil,
  brand,
}: TemplateComponentProps<'subscription-cancelled'>) {
  const urls = urlsFor(brand)
  return (
    <BaseLayout preview={`Your ${brand.appName} ${planName} subscription was cancelled.`} brand={brand}>
      <EmailHeading>Your subscription was cancelled</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Your {planName} subscription has been cancelled and you won't be charged again.
        {accessUntil !== undefined
          ? ' You keep full access until the end of the period you already paid for.'
          : ' Your account has moved to the free plan.'}
      </Paragraph>

      <InfoTable
        rows={[
          { label: 'Plan', value: planName },
          { label: 'Access until', value: accessUntil },
        ]}
      />

      <Callout tone="info" title="Your data stays put">
        Nothing is deleted. Your Knowledge Base, jobs, applications and generated résumés remain exactly
        as they are — the free plan only limits how many NEW jobs and résumés you can create.
      </Callout>

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={urls.billing}>Reactivate {planName}</ActionButton>
      </Section>

      <Paragraph tone="muted">
        If you cancelled because something wasn't working, reply and tell us — we'd genuinely like to know.
      </Paragraph>
    </BaseLayout>
  )
}

const SubscriptionCancelledPreview = withPreview(SubscriptionCancelled, {
  name: 'Ana',
  planName: 'Pro',
  accessUntil: '3 Sep 2026',
  brand: previewBrand,
})

export default SubscriptionCancelledPreview
