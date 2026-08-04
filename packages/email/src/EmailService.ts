/**
 * EmailService — the only way anything in this codebase sends email.
 *
 * Design notes:
 *
 *  • **One send path.** All 14 public methods delegate to the private `dispatch`, which renders, builds
 *    the idempotency key, applies the retry policy and logs. Adding a template adds ~4 lines here and
 *    changes the delivery mechanics for nothing.
 *
 *  • **Logging is plain `console` with an `[email]` prefix**, matching the house convention used by
 *    `src/repositories/persist.ts` and the Zustand stores. No logger abstraction: this runs in Deno Edge
 *    Functions where `console` output already lands in the Supabase function logs, so a port would add
 *    indirection without buying anything.
 *
 *  • **Constructor injection, no framework.** Dependencies arrive as one `EmailServiceDeps` object and
 *    are assigned in the constructor body — parameter properties are unavailable because the tsconfig
 *    sets `erasableSyntaxOnly`. Tests construct it directly with `InMemoryTransport`; Edge Functions use
 *    the `createEmailService` factory.
 *
 *  • **Deterministic idempotency keys.** `template:userId-or-recipient:dedupeKey`, hashed to stay inside
 *    provider length limits. The same logical send always produces the same key, so a retry — or two
 *    concurrent webhook deliveries of the same Stripe event — collapses into one delivered message.
 *
 *  • **Never throws for "not configured".** With no API key the service returns
 *    `{ skipped: true }` instead of failing, so a webhook in a dev environment still succeeds. Real
 *    failures (render errors, provider rejections) DO throw, typed.
 */

import { EmailValidationError, describeEmailError } from './errors.ts'
import { createBrandContext, renderTemplate } from './renderer.ts'
import { templateRegistry } from './registry.ts'
import { createResendTransport } from './transport/ResendTransport.ts'
import { createInMemoryTransport } from './transport/InMemoryTransport.ts'
import { DEFAULT_RETRY_POLICY, defaultRetryDeps, withRetry, type RetryDeps, type RetryPolicy } from './transport/retry.ts'
import type { EmailTransport } from './transport/EmailTransport.ts'
import type { EmailConfig } from './config.ts'
import type { OutboundEmail, SendOptions, SendResult } from './types.ts'
import type {
  BillingSuccessProps,
  EmailChangedProps,
  InvitationProps,
  MagicLinkProps,
  PasswordChangedProps,
  PasswordResetProps,
  PaymentFailedProps,
  SecurityAlertProps,
  SubscriptionCancelledProps,
  SubscriptionCreatedProps,
  TemplateDefinitions,
  TemplateName,
  TrialEndingProps,
  TrialExpiredProps,
  VerifyEmailProps,
  WelcomeProps,
} from './templates/props.ts'

/** Loose enough to reject obvious garbage without rejecting valid exotic addresses. */
const RECIPIENT_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

/** Resend tag values accept only ASCII letters, digits, underscore and dash. */
const TAG_SAFE = /[^A-Za-z0-9_-]/g

/**
 * FNV-1a, rendered as hex. A non-cryptographic hash is the right tool here: the key only has to be
 * stable and collision-resistant enough to distinguish sends, and this avoids pulling in a crypto
 * dependency that behaves differently across Node, Deno and the browser.
 */
function hashKey(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export interface EmailServiceDeps {
  transport: EmailTransport
  config: EmailConfig
  /** Injected so retry timing is deterministic under test. */
  retryDeps?: RetryDeps
}

export class EmailService {
  private readonly transport: EmailTransport
  private readonly config: EmailConfig
  private readonly retryPolicy: RetryPolicy
  private readonly retryDeps: RetryDeps

  constructor(deps: EmailServiceDeps) {
    this.transport = deps.transport
    this.config = deps.config
    this.retryPolicy = deps.config.retry ?? DEFAULT_RETRY_POLICY
    this.retryDeps = deps.retryDeps ?? defaultRetryDeps
  }

  // ── Auth ────────────────────────────────────────────────────────────────────────────────────────

  sendWelcome(to: string, props: WelcomeProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('welcome', to, props, options)
  }

  sendVerification(to: string, props: VerifyEmailProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('verify-email', to, props, options)
  }

  sendPasswordReset(to: string, props: PasswordResetProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('password-reset', to, props, options)
  }

  sendMagicLink(to: string, props: MagicLinkProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('magic-link', to, props, options)
  }

  sendInvitation(to: string, props: InvitationProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('invitation', to, props, options)
  }

  // ── Account security ────────────────────────────────────────────────────────────────────────────

  sendSecurityAlert(to: string, props: SecurityAlertProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('security-alert', to, props, options)
  }

  sendEmailChanged(to: string, props: EmailChangedProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('email-changed', to, props, options)
  }

  sendPasswordChanged(to: string, props: PasswordChangedProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('password-changed', to, props, options)
  }

  // ── Billing ─────────────────────────────────────────────────────────────────────────────────────

  sendBillingSuccess(to: string, props: BillingSuccessProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('billing-success', to, props, options)
  }

  sendSubscriptionCreated(to: string, props: SubscriptionCreatedProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('subscription-created', to, props, options)
  }

  sendSubscriptionCancelled(
    to: string,
    props: SubscriptionCancelledProps,
    options?: SendOptions,
  ): Promise<SendResult> {
    return this.dispatch('subscription-cancelled', to, props, options)
  }

  sendTrialEnding(to: string, props: TrialEndingProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('trial-ending', to, props, options)
  }

  sendTrialExpired(to: string, props: TrialExpiredProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('trial-expired', to, props, options)
  }

  sendPaymentFailed(to: string, props: PaymentFailedProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('payment-failed', to, props, options)
  }

  // ── Internals ───────────────────────────────────────────────────────────────────────────────────

  /**
   * Escape hatch for callers that hold a template name as data (the auth hook maps Supabase's
   * `email_action_type` to one, the billing webhook maps a Stripe event type). Still fully typed: the
   * props must match the named template.
   */
  send<N extends TemplateName>(
    template: N,
    to: string,
    props: TemplateDefinitions[N],
    options?: SendOptions,
  ): Promise<SendResult> {
    return this.dispatch(template, to, props, options)
  }

  /** True when a real provider is wired up. Callers can skip building props when it isn't. */
  get isConfigured(): boolean {
    return this.config.apiKey !== undefined
  }

  /**
   * The subject a send WOULD use, without rendering the body.
   *
   * Exists so a caller can write its `email_log` claim row (which needs a subject) BEFORE attempting
   * delivery. Claiming first is what makes the log an idempotency ledger rather than a post-hoc record:
   * the unique constraint on `idempotency_key` rejects the second concurrent attempt.
   */
  subjectFor<N extends TemplateName>(template: N, props: TemplateDefinitions[N], options?: SendOptions): string {
    return templateRegistry[template].subject(props, this.brandContext(options?.preferencesUrl))
  }

  private brandContext(preferencesUrl?: string) {
    return createBrandContext({
      appName: this.config.appName,
      appUrl: this.config.appUrl,
      supportEmail: this.config.supportEmail,
      preferencesUrl,
    })
  }

  /**
   * Stable per-send key. Two sends collapse into one iff template, recipient/user and dedupeKey match.
   * The readable prefix is kept so the key is diagnosable in provider logs; the hash carries the rest.
   */
  buildIdempotencyKey<N extends TemplateName>(template: N, to: string, options?: SendOptions): string {
    const subject = options?.userId ?? to.toLowerCase()
    const dedupe = options?.dedupeKey ?? 'default'
    return `${template}-${hashKey(`${template}:${subject}:${dedupe}`)}`
  }

  private async dispatch<N extends TemplateName>(
    template: N,
    to: string,
    props: TemplateDefinitions[N],
    options?: SendOptions,
  ): Promise<SendResult> {
    const recipient = to.trim()
    if (!RECIPIENT_PATTERN.test(recipient)) {
      throw new EmailValidationError(`"${to}" is not a valid email address.`)
    }

    const idempotencyKey = this.buildIdempotencyKey(template, recipient, options)
    const brand = this.brandContext(options?.preferencesUrl)

    // Render BEFORE checking configuration: a broken template must fail loudly in dev too, where there
    // is no API key. Otherwise template bugs only ever surface in production.
    const rendered = await renderTemplate(template, props, brand)

    const email: OutboundEmail = {
      to: recipient,
      from: this.config.from,
      replyTo: options?.replyTo ?? this.config.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        // Tells conforming clients not to auto-reply (out-of-office) to transactional mail.
        'X-Auto-Response-Suppress': 'All',
        'Auto-Submitted': 'auto-generated',
      },
      tags: [{ name: 'template', value: template.replace(TAG_SAFE, '_') }, ...(options?.tags ?? [])],
    }

    if (!this.isConfigured) {
      console.warn(`[email] skipping ${template} to ${recipient} — RESEND_API_KEY is not configured`)
      return {
        id: null,
        template,
        to: recipient,
        subject: rendered.subject,
        idempotencyKey,
        skipped: true,
        provider: 'noop',
      }
    }

    try {
      const result = await withRetry(
        () => this.transport.send(email, { idempotencyKey }),
        this.retryPolicy,
        this.retryDeps,
        ({ attempt, delayMs, error }) => {
          const { code, message } = describeEmailError(error)
          console.warn(
            `[email] ${template} to ${recipient} failed (attempt ${attempt}), retrying in ${delayMs}ms: ${code} ${message}`,
          )
        },
      )

      console.info(`[email] sent ${template} to ${recipient} (id: ${result.id ?? 'none'})`)
      return {
        id: result.id,
        template,
        to: recipient,
        subject: rendered.subject,
        idempotencyKey,
        skipped: false,
        provider: result.provider,
      }
    } catch (error) {
      const { code, message } = describeEmailError(error)
      console.error(`[email] ${template} to ${recipient} failed permanently: ${code} ${message}`)
      throw error
    }
  }
}

export interface CreateEmailServiceOptions {
  config: EmailConfig
  /** Startup notes from `loadEmailConfig`, logged once here rather than by every caller. */
  warnings?: string[]
  /** Overrides the transport entirely — used by tests and by the HTML export script. */
  transport?: EmailTransport
  retryDeps?: RetryDeps
}

/**
 * Composition root. Picks the transport based on configuration — Resend when there's a key, the no-op
 * in-memory recorder when there isn't — mirroring how `initSentry()` and `initAnalytics()` degrade to
 * no-ops in this codebase when their keys are absent.
 */
export function createEmailService(options: CreateEmailServiceOptions): EmailService {
  options.warnings?.forEach((warning) => console.warn(`[email] ${warning}`))

  const transport =
    options.transport ??
    (options.config.apiKey !== undefined
      ? createResendTransport({ apiKey: options.config.apiKey })
      : createInMemoryTransport('noop'))

  return new EmailService({ transport, config: options.config, retryDeps: options.retryDeps })
}
