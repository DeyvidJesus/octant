// `customer.subscription.trial_will_end` (3 days out). Nothing triggers it until checkout sets `trial_period_days`.

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

export function TrialEnding({
  name,
  planName,
  daysRemaining,
  trialEndsOn,
  brand,
}: TemplateComponentProps<'trial-ending'>) {
  const urls = urlsFor(brand)
  const remaining = pluralize(Math.max(0, daysRemaining), 'day')

  return (
    <BaseLayout preview={`Your ${brand.appName} trial ends in ${remaining}.`} brand={brand}>
      <EmailHeading>Your trial ends in {remaining}</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Your {planName} trial is nearly over. Add a payment method to keep unlimited jobs and tailored
        résumés — no interruption, nothing to migrate.
      </Paragraph>

      <InfoTable
        rows={[
          { label: 'Plan', value: planName },
          { label: 'Trial ends', value: trialEndsOn },
          { label: 'Time remaining', value: remaining },
        ]}
      />

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={urls.billing}>Keep {planName}</ActionButton>
      </Section>

      <Callout tone="neutral" title="If you do nothing">
        Your account simply moves to the free plan when the trial ends. Everything you've created stays —
        you'll just be limited on creating new jobs and résumés.
      </Callout>
    </BaseLayout>
  )
}

const TrialEndingPreview = withPreview(TrialEnding, {
  name: 'Ana',
  planName: 'Pro',
  daysRemaining: 3,
  trialEndsOn: '7 Aug 2026',
  brand: previewBrand,
})

export default TrialEndingPreview
