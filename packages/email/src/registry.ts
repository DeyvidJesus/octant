/**
 * The template registry: name → { subject, component }.
 *
 * This is the seam that makes the whole package non-duplicative. Because it is typed as
 * `Record<TemplateName, …>` over `TemplateDefinitions`, TypeScript refuses to compile if a template is
 * added to the map without props, or props without a registry entry. `EmailService` then needs no
 * per-template logic at all — its 14 public methods all funnel through one `dispatch`.
 *
 * Subjects live HERE rather than inside each component, because a subject is not part of the rendered
 * document: it has to be readable without rendering (for logging and tests), and it must never contain
 * markup. Keeping them together also makes the whole inbox voice reviewable in one screen.
 */

import type { ComponentType } from 'react'
import { BillingSuccess } from './templates/transactional/BillingSuccess.tsx'
import { EmailChanged } from './templates/transactional/EmailChanged.tsx'
import { Invitation } from './templates/transactional/Invitation.tsx'
import { MagicLink } from './templates/transactional/MagicLink.tsx'
import { PasswordChanged } from './templates/transactional/PasswordChanged.tsx'
import { PasswordReset } from './templates/transactional/PasswordReset.tsx'
import { PaymentFailed } from './templates/transactional/PaymentFailed.tsx'
import { SecurityAlert } from './templates/transactional/SecurityAlert.tsx'
import { SubscriptionCancelled } from './templates/transactional/SubscriptionCancelled.tsx'
import { SubscriptionCreated } from './templates/transactional/SubscriptionCreated.tsx'
import { TrialEnding } from './templates/transactional/TrialEnding.tsx'
import { TrialExpired } from './templates/transactional/TrialExpired.tsx'
import { VerifyEmail } from './templates/transactional/VerifyEmail.tsx'
import { Welcome } from './templates/transactional/Welcome.tsx'
import { pluralize } from './templates/greeting.ts'
import {
  SecurityAlertKind,
  type EmailBrandContext,
  type TemplateComponentProps,
  type TemplateDefinitions,
  type TemplateName,
} from './templates/props.ts'

export interface TemplateDefinition<N extends TemplateName> {
  /** Built from the props, so subjects can carry real detail (amounts, plan names, day counts). */
  subject: (props: TemplateDefinitions[N], brand: EmailBrandContext) => string
  component: ComponentType<TemplateComponentProps<N>>
  /**
   * Whether the message is a security/account notice that must be delivered regardless of a user's
   * notification preferences. Every template here is transactional, but stating it explicitly means a
   * future marketing template cannot be added without someone deciding.
   */
  critical: boolean
}

type Registry = { [N in TemplateName]: TemplateDefinition<N> }

/** Subject-line copy per alert kind, so `security-alert` gets a specific subject, not a generic one. */
const SECURITY_ALERT_SUBJECTS: Record<string, string> = {
  [SecurityAlertKind.NewSignIn]: 'New sign-in to your account',
  [SecurityAlertKind.NewDevice]: 'A new device signed in to your account',
  [SecurityAlertKind.SuspiciousActivity]: 'Unusual activity on your account',
  [SecurityAlertKind.Reauthentication]: 'Your confirmation code',
}

export const templateRegistry: Registry = {
  welcome: {
    subject: (_props, brand) => `Welcome to ${brand.appName}`,
    component: Welcome,
    critical: true,
  },
  'verify-email': {
    subject: (_props, brand) => `Confirm your email for ${brand.appName}`,
    component: VerifyEmail,
    critical: true,
  },
  'password-reset': {
    subject: (_props, brand) => `Reset your ${brand.appName} password`,
    component: PasswordReset,
    critical: true,
  },
  'magic-link': {
    subject: (_props, brand) => `Your ${brand.appName} sign-in link`,
    component: MagicLink,
    critical: true,
  },
  invitation: {
    subject: (props, brand) => {
      const inviter = props.inviterName ?? props.inviterEmail
      const destination = props.workspaceName ?? brand.appName
      return inviter !== undefined
        ? `${inviter} invited you to ${destination}`
        : `You're invited to ${destination}`
    },
    component: Invitation,
    critical: true,
  },
  'billing-success': {
    subject: (props, brand) => `Your ${brand.appName} receipt — ${props.amountFormatted}`,
    component: BillingSuccess,
    critical: true,
  },
  'subscription-created': {
    subject: (props, brand) => `You're on ${brand.appName} ${props.planName}`,
    component: SubscriptionCreated,
    critical: true,
  },
  'subscription-cancelled': {
    subject: (props) => `Your ${props.planName} subscription was cancelled`,
    component: SubscriptionCancelled,
    critical: true,
  },
  'trial-ending': {
    subject: (props) =>
      props.daysRemaining <= 0
        ? 'Your trial ends today'
        : `Your trial ends in ${pluralize(props.daysRemaining, 'day')}`,
    component: TrialEnding,
    critical: true,
  },
  'trial-expired': {
    subject: (_props, brand) => `Your ${brand.appName} trial has ended`,
    component: TrialExpired,
    critical: true,
  },
  'payment-failed': {
    subject: () => "Your payment didn't go through",
    component: PaymentFailed,
    critical: true,
  },
  'security-alert': {
    subject: (props) => SECURITY_ALERT_SUBJECTS[props.kind] ?? 'Security alert on your account',
    component: SecurityAlert,
    critical: true,
  },
  'email-changed': {
    subject: (props) =>
      props.confirmUrl !== undefined ? 'Confirm your new email address' : 'Your email address was changed',
    component: EmailChanged,
    critical: true,
  },
  'password-changed': {
    subject: () => 'Your password was changed',
    component: PasswordChanged,
    critical: true,
  },
}

/** Every registered template name. Used by the invariant tests and the HTML export script. */
export const TEMPLATE_NAMES = Object.keys(templateRegistry) as TemplateName[]
