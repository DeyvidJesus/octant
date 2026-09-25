// One set of sample props, read off each template's `PreviewProps`, shared by the dev server, the tests
// and the HTML export so they cannot drift.

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

/** The fixture for one template. */
export function fixturePropsFor<N extends TemplateName>(name: N): TemplateComponentProps<N> {
  return templateFixtures[name]
}
