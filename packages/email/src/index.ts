/**
 * `@octant/email` — the public surface.
 *
 * Consumers (Supabase Edge Functions, scripts) import from here and nowhere else. Nothing below this
 * barrel is part of the contract, which is what keeps the Resend SDK an implementation detail: there is
 * no export path that reaches it.
 *
 * This package is SERVER-ONLY. It must never be imported from `src/` — it pulls in `resend` and
 * `react-dom/server`, and the app bundle has no business containing either. The app talks to email
 * through the `send-email` Edge Function instead (`src/services/email/notifications.ts`).
 */

// ── Service ───────────────────────────────────────────────────────────────────────────────────────
export { EmailService, createEmailService } from './EmailService.ts'
export type { EmailServiceDeps, CreateEmailServiceOptions } from './EmailService.ts'

// ── Configuration ─────────────────────────────────────────────────────────────────────────────────
export { loadEmailConfig, extractAddress, EMAIL_CONFIG_DEFAULTS } from './config.ts'
export type { EmailConfig, LoadedEmailConfig, EnvReader } from './config.ts'

// ── Errors ────────────────────────────────────────────────────────────────────────────────────────
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

// ── Transports (ports + adapters) ─────────────────────────────────────────────────────────────────
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

// ── Rendering ─────────────────────────────────────────────────────────────────────────────────────
export { renderTemplate, createBrandContext } from './renderer.ts'
export { templateRegistry, TEMPLATE_NAMES } from './registry.ts'
export type { TemplateDefinition } from './registry.ts'

// ── Value types ───────────────────────────────────────────────────────────────────────────────────
export type {
  OutboundEmail,
  RenderedEmail,
  SendOptions,
  SendResult,
  TransportResult,
} from './types.ts'

// ── Template contracts ────────────────────────────────────────────────────────────────────────────
export { SecurityAlertKind } from './templates/props.ts'
export type {
  EmailBrandContext,
  SecurityAlertKindValue,
  TemplateComponentProps,
  TemplateDefinitions,
  TemplateName,
  // Per-template props, so callers can type their own builders.
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

// ── Provider integrations (pure payload → template mappings) ───────────────────────────────────────
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

// ── Formatting helpers (shared with the Edge Functions that build props) ───────────────────────────
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
