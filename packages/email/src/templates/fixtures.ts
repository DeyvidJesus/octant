/**
 * Sample props for every template — ONE set, used by three consumers:
 *
 *   • the React Email dev server (`yarn email:dev`), via each template's `PreviewProps` static,
 *   • the invariant tests in `renderer.test.ts`,
 *   • the static HTML export (`yarn email:export`).
 *
 * Reading them back off the default exports rather than redeclaring them is the point: sample data that
 * exists twice drifts, and a preview that renders fine while the test fixture is stale (or vice versa)
 * is worse than no preview at all.
 *
 * The `Record` is typed over `TemplateName`, so a new template cannot be added without a fixture.
 */

import BillingSuccessPreview from './transactional/BillingSuccess.tsx'
import EmailChangedPreview from './transactional/EmailChanged.tsx'
import InvitationPreview from './transactional/Invitation.tsx'
import MagicLinkPreview from './transactional/MagicLink.tsx'
import PasswordChangedPreview from './transactional/PasswordChanged.tsx'
import PasswordResetPreview from './transactional/PasswordReset.tsx'
import PaymentFailedPreview from './transactional/PaymentFailed.tsx'
import SecurityAlertPreview from './transactional/SecurityAlert.tsx'
import SubscriptionCancelledPreview from './transactional/SubscriptionCancelled.tsx'
import SubscriptionCreatedPreview from './transactional/SubscriptionCreated.tsx'
import TrialEndingPreview from './transactional/TrialEnding.tsx'
import TrialExpiredPreview from './transactional/TrialExpired.tsx'
import VerifyEmailPreview from './transactional/VerifyEmail.tsx'
import WelcomePreview from './transactional/Welcome.tsx'
import type { TemplateComponentProps, TemplateName } from './props.ts'

type Fixtures = { [N in TemplateName]: TemplateComponentProps<N> }

export const templateFixtures: Fixtures = {
  welcome: WelcomePreview.PreviewProps,
  'verify-email': VerifyEmailPreview.PreviewProps,
  'password-reset': PasswordResetPreview.PreviewProps,
  'magic-link': MagicLinkPreview.PreviewProps,
  invitation: InvitationPreview.PreviewProps,
  'billing-success': BillingSuccessPreview.PreviewProps,
  'subscription-created': SubscriptionCreatedPreview.PreviewProps,
  'subscription-cancelled': SubscriptionCancelledPreview.PreviewProps,
  'trial-ending': TrialEndingPreview.PreviewProps,
  'trial-expired': TrialExpiredPreview.PreviewProps,
  'payment-failed': PaymentFailedPreview.PreviewProps,
  'security-alert': SecurityAlertPreview.PreviewProps,
  'email-changed': EmailChangedPreview.PreviewProps,
  'password-changed': PasswordChangedPreview.PreviewProps,
}

/** The fixture for one template, with the injected `brand` removed — the shape a caller supplies. */
export function fixturePropsFor<N extends TemplateName>(name: N): TemplateComponentProps<N> {
  return templateFixtures[name]
}
