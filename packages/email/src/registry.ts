// Template name to { subject, component }. The mapped type fails to compile if a template lacks props or
// an entry; subjects live here so they can be computed without rendering and never contain markup.

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
  subject: (props: TemplateDefinitions[N], brand: EmailBrandContext) => string
  component: ComponentType<TemplateComponentProps<N>>
  /** Delivered regardless of notification preferences; explicit so new templates must decide. */
  critical: boolean
}

type Registry = { [N in TemplateName]: TemplateDefinition<N> }

/** Subject per security alert kind. */
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

/** Every registered template name (used by tests and the HTML export script). */
export const TEMPLATE_NAMES = Object.keys(templateRegistry) as TemplateName[]
