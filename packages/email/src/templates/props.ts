// Props for every template. Dependency-free to avoid import cycles; dates and money arrive pre-formatted.

/** Injected into every template by the renderer; callers never pass it. */
export interface EmailBrandContext {
  /** Product name, e.g. "Octant". */
  appName: string
  /** Absolute origin used to build links, e.g. "https://app.useoctant.com" (no trailing slash). */
  appUrl: string
  /** Where "contact us" points. */
  supportEmail: string
  /** Per-recipient notification-preferences link, when the caller has an unsubscribe token. */
  preferencesUrl?: string
}

/** Fields shared by nearly every template. */
interface RecipientProps {
  /** The recipient's display name. Templates fall back to a neutral greeting when absent. */
  name?: string
}

/** Fields shared by the "someone did something to your account" notices. */
interface ActivityContextProps {
  /** Pre-formatted timestamp, e.g. "4 Aug 2026 at 14:32 UTC". */
  occurredAt?: string
  ipAddress?: string
  userAgent?: string
  /** Coarse location derived from the IP, e.g. "São Paulo, BR". */
  location?: string
}

export interface WelcomeProps extends RecipientProps {}

export interface VerifyEmailProps extends RecipientProps {
  verifyUrl: string
  /** Copy-paste fallback for clients that mangle links. */
  token?: string
  expiresInMinutes?: number
}

export interface PasswordResetProps extends RecipientProps, ActivityContextProps {
  resetUrl: string
  token?: string
  expiresInMinutes?: number
}

export interface MagicLinkProps extends RecipientProps {
  magicLinkUrl: string
  token?: string
  expiresInMinutes?: number
}

export interface InvitationProps {
  inviteUrl: string
  inviterName?: string
  inviterEmail?: string
  /** Team/workspace being joined. Omitted for a plain product invite. */
  workspaceName?: string
  expiresInDays?: number
}

/** What triggered a security alert. */
export const SecurityAlertKind = {
  NewSignIn: 'new_sign_in',
  NewDevice: 'new_device',
  SuspiciousActivity: 'suspicious_activity',
  Reauthentication: 'reauthentication',
} as const

export type SecurityAlertKindValue = (typeof SecurityAlertKind)[keyof typeof SecurityAlertKind]

export interface SecurityAlertProps extends RecipientProps, ActivityContextProps {
  kind: SecurityAlertKindValue
  /** One-time confirmation code, for the reauthentication flow. */
  code?: string
  /** Where to go to lock the account down (defaults to the app's settings page). */
  secureAccountUrl?: string
}

export interface EmailChangedProps extends RecipientProps, ActivityContextProps {
  newEmail: string
  oldEmail?: string
  /** Present for the confirmation sent to the new address; absent for the notice to the old one. */
  confirmUrl?: string
}

export interface PasswordChangedProps extends RecipientProps, ActivityContextProps {
  /** Escape hatch shown in the "wasn't you?" block. */
  resetUrl?: string
}

export interface BillingSuccessProps extends RecipientProps {
  planName: string
  /** Pre-formatted total, e.g. "R$ 49,00". */
  amountFormatted: string
  invoiceNumber?: string
  invoiceUrl?: string
  /** Pre-formatted end of the paid period, e.g. "3 Sep 2026". */
  periodEnd?: string
}

export interface SubscriptionCreatedProps extends RecipientProps {
  planName: string
  amountFormatted?: string
  /** Pre-formatted billing cadence, e.g. "month". */
  interval?: string
  renewsOn?: string
}

export interface SubscriptionCancelledProps extends RecipientProps {
  planName: string
  /** Pre-formatted date access ends; absent means access ended immediately. */
  accessUntil?: string
}

export interface TrialEndingProps extends RecipientProps {
  planName: string
  daysRemaining: number
  trialEndsOn: string
}

export interface TrialExpiredProps extends RecipientProps {
  planName: string
}

export interface PaymentFailedProps extends RecipientProps {
  amountFormatted?: string
  /** The provider's decline reason, already made human-readable. */
  reason?: string
  nextAttemptOn?: string
  /** How long access survives before downgrade. */
  gracePeriodDays?: number
}

/** Template name to caller props; the registry and fixtures are typed over this map. */
export interface TemplateDefinitions {
  welcome: WelcomeProps
  'verify-email': VerifyEmailProps
  'password-reset': PasswordResetProps
  'magic-link': MagicLinkProps
  invitation: InvitationProps
  'billing-success': BillingSuccessProps
  'subscription-created': SubscriptionCreatedProps
  'subscription-cancelled': SubscriptionCancelledProps
  'trial-ending': TrialEndingProps
  'trial-expired': TrialExpiredProps
  'payment-failed': PaymentFailedProps
  'security-alert': SecurityAlertProps
  'email-changed': EmailChangedProps
  'password-changed': PasswordChangedProps
}

/** Valid template identifiers, also stored in `email_log.template`. */
export type TemplateName = keyof TemplateDefinitions

/** Caller props plus the injected brand context. */
export type TemplateComponentProps<N extends TemplateName> = TemplateDefinitions[N] & {
  brand: EmailBrandContext
}
