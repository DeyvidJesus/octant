/**
 * Welcome — sent once, after the address is confirmed.
 *
 * Deliberately short and single-purpose: one CTA into the product, and a three-step "what to do first"
 * list that mirrors the real onboarding path (Knowledge Base → job → tailored résumé).
 */

import { Section } from '@react-email/components'
import { urlsFor } from '../../brand/urls.ts'
import { spacing } from '../../brand/tokens.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { InfoTable } from '../components/InfoTable.tsx'
import { EmailHeading, Label, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { greetingFor } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function Welcome({ name, brand }: TemplateComponentProps<'welcome'>) {
  const urls = urlsFor(brand)
  return (
    <BaseLayout preview={`Welcome to ${brand.appName} — here's how to get your first tailored résumé.`} brand={brand}>
      <EmailHeading>Welcome to {brand.appName}</EmailHeading>
      <Paragraph>{greetingFor(name)}</Paragraph>
      <Paragraph>
        Your account is ready. {brand.appName} keeps one master record of your career and turns it into a
        résumé tailored to each role you apply for — so you stop rewriting the same bullets by hand.
      </Paragraph>

      <Label>Start here</Label>
      <InfoTable
        rows={[
          { label: '1 · Knowledge Base', value: 'Add your roles, projects and achievements once' },
          { label: '2 · Add a job', value: 'Paste a posting you actually want' },
          { label: '3 · Generate', value: 'Get a résumé matched to that posting' },
        ]}
      />

      <Section style={{ padding: `${spacing.sm} 0 ${spacing.md}` }}>
        <ActionButton href={urls.dashboard}>Open {brand.appName}</ActionButton>
      </Section>

      <Paragraph tone="muted">
        Not sure where to begin? Reply to this email — a real person reads it.
      </Paragraph>
    </BaseLayout>
  )
}

const WelcomePreview = withPreview(Welcome, { name: 'Ana', brand: previewBrand })

export default WelcomePreview
