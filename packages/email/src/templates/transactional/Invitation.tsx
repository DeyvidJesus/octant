/**
 * Invitation — Supabase Auth's `invite` action, and any future team-invite flow.
 *
 * NOTE: the product is single-user today (no teams, no `invitations` table), so nothing triggers this
 * automatically yet. It is fully implemented and callable via `EmailService.sendInvitation()` so that
 * adding the feature is a wiring change, not a template-writing exercise. `workspaceName` is optional
 * precisely so it works as a plain product invite until teams exist.
 */

import { Section } from '@react-email/components'
import { spacing } from '../../brand/tokens.ts'
import { ActionButton } from '../components/ActionButton.tsx'
import { FallbackLink } from '../components/FallbackLink.tsx'
import { EmailHeading, Paragraph } from '../components/typography.tsx'
import { BaseLayout } from '../layouts/BaseLayout.tsx'
import { pluralize } from '../greeting.ts'
import { previewBrand, withPreview } from '../preview.ts'
import type { TemplateComponentProps } from '../props.ts'

export function Invitation({
  inviteUrl,
  inviterName,
  inviterEmail,
  workspaceName,
  expiresInDays,
  brand,
}: TemplateComponentProps<'invitation'>) {
  const inviter = inviterName ?? inviterEmail
  const destination = workspaceName ?? brand.appName
  const headline = workspaceName !== undefined ? `Join ${workspaceName}` : `You're invited to ${brand.appName}`

  return (
    <BaseLayout
      preview={
        inviter !== undefined ? `${inviter} invited you to ${destination}.` : `You've been invited to ${destination}.`
      }
      brand={brand}
    >
      <EmailHeading>{headline}</EmailHeading>
      <Paragraph>
        {inviter !== undefined ? `${inviter} invited you to ` : 'You have been invited to '}
        join {destination} on {brand.appName} — one master record of your career, turned into a résumé
        tailored to every role you apply for.
      </Paragraph>

      <Section style={{ padding: `${spacing.xs} 0 ${spacing.md}` }}>
        <ActionButton href={inviteUrl}>Accept invitation</ActionButton>
      </Section>

      {expiresInDays !== undefined && expiresInDays > 0 && (
        <Paragraph tone="muted">
          This invitation expires in {pluralize(expiresInDays, 'day')}.
        </Paragraph>
      )}

      <FallbackLink url={inviteUrl} />

      <Paragraph tone="muted">
        Not expecting this? You can ignore this email and no account will be created.
      </Paragraph>
    </BaseLayout>
  )
}

const InvitationPreview = withPreview(Invitation, {
  inviteUrl: 'https://app.useoctant.com/auth/callback?token_hash=preview&type=invite',
  inviterName: 'Ana Souza',
  inviterEmail: 'ana@example.com',
  workspaceName: 'Acme Talent',
  expiresInDays: 7,
  brand: previewBrand,
})

export default InvitationPreview
