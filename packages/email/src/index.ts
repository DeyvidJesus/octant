// Public surface of `@octant/email`. Server-only: never import it from `src/`, since it pulls in `resend`
// and `react-dom/server`; the app sends email through the `send-email` Edge Function.

export { EmailService, createEmailService } from './EmailService.ts'
export type { EmailServiceDeps, CreateEmailServiceOptions } from './EmailService.ts'

export { loadEmailConfig, extractAddress, EMAIL_CONFIG_DEFAULTS } from './config.ts'
export type { EmailConfig, LoadedEmailConfig, EnvReader } from './config.ts'

export {
  EmailError,
  EmailConfigError,
  EmailValidationError,
  EmailRenderError,
  EmailTransportError,
  EmailRateLimitError,
  EmailSuppressedError,
  isEmailError,
  describeEmailError,
} from './errors.ts'

export type {
  EmailTransport,
  EmailSuppressionStore,
  EmailWebhookVerifier,
  TransportSendOptions,
} from './transport/EmailTransport.ts'
export {
  createResendTransport,
  createResendSuppressions,
  createResendWebhookVerifier,
} from './transport/ResendTransport.ts'
export { createInMemoryTransport } from './transport/InMemoryTransport.ts'
export type { InMemoryTransport, RecordedEmail } from './transport/InMemoryTransport.ts'
export {
  withRetry,
  isRetryable,
  backoffDelay,
  DEFAULT_RETRY_POLICY,
  defaultRetryDeps,
} from './transport/retry.ts'
export type { RetryPolicy, RetryDeps } from './transport/retry.ts'

export { renderTemplate, createBrandContext } from './renderer.ts'
export { templateRegistry, TEMPLATE_NAMES } from './registry.ts'
export type { TemplateDefinition } from './registry.ts'

export type {
  OutboundEmail,
  RenderedEmail,
  SendOptions,
  SendResult,
  TransportResult,
} from './types.ts'

export { SecurityAlertKind } from './templates/props.ts'
export type {
  EmailBrandContext,
  SecurityAlertKindValue,
  TemplateComponentProps,
  TemplateDefinitions,
  TemplateName,
  WelcomeProps,
  VerifyEmailProps,
  PasswordResetProps,
  MagicLinkProps,
  InvitationProps,
  BillingSuccessProps,
  SubscriptionCreatedProps,
  SubscriptionCancelledProps,
  TrialEndingProps,
  TrialExpiredProps,
  PaymentFailedProps,
  SecurityAlertProps,
  EmailChangedProps,
  PasswordChangedProps,
} from './templates/props.ts'

export {
  AuthEmailAction,
  buildVerificationUrl,
  displayNameFrom,
  mapAuthEmail,
} from './integrations/supabaseAuth.ts'
export type {
  AuthEmailActionValue,
  AuthEmailContext,
  AuthHookPayload,
  MappedAuthEmail,
} from './integrations/supabaseAuth.ts'
export {
  BILLING_EVENT_TYPES,
  BillingEvent,
  mapBillingEmail,
  userIdFromSubscription,
} from './integrations/stripeBilling.ts'
export type {
  BillingEmailContext,
  BillingEventValue,
  MappedBillingEmail,
  StripeEventLike,
  StripeInvoiceLike,
  StripeSubscriptionLike,
} from './integrations/stripeBilling.ts'

export {
  daysBetween,
  formatDate,
  formatDateTime,
  formatMoney,
  fromMinorUnits,
} from './formatting.ts'
export type { FormattingOptions } from './formatting.ts'
export { greetingFor, pluralize, expiryNote } from './templates/greeting.ts'
export { createUrls, urlsFor } from './brand/urls.ts'
export type { EmailUrls } from './brand/urls.ts'
export { colors, fonts, Tone } from './brand/tokens.ts'
export type { ToneValue } from './brand/tokens.ts'
