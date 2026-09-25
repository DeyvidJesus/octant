// The single send path: every public method goes through `dispatch` (render, idempotency key, retry, log).
// Without an API key sends return `{ skipped: true }`; render and provider failures still throw.

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

/** Loose on purpose: rejects obvious garbage without rejecting valid exotic addresses. */
const RECIPIENT_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

/** Resend tag values accept only ASCII letters, digits, underscore and dash. */
const TAG_SAFE = /[^A-Za-z0-9_-]/g

/** FNV-1a as hex; avoids a crypto dependency that differs across Node, Deno and the browser. */
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

  sendSecurityAlert(to: string, props: SecurityAlertProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('security-alert', to, props, options)
  }

  sendEmailChanged(to: string, props: EmailChangedProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('email-changed', to, props, options)
  }

  sendPasswordChanged(to: string, props: PasswordChangedProps, options?: SendOptions): Promise<SendResult> {
    return this.dispatch('password-changed', to, props, options)
  }

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

  /** For callers holding the template name as data (auth hook, billing webhook); props stay typed. */
  send<N extends TemplateName>(
    template: N,
    to: string,
    props: TemplateDefinitions[N],
    options?: SendOptions,
  ): Promise<SendResult> {
    return this.dispatch(template, to, props, options)
  }

  /** True when a real provider is wired up. */
  get isConfigured(): boolean {
    return this.config.apiKey !== undefined
  }

  /** Subject without rendering the body, so callers can write their `email_log` claim row before sending. */
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

  /** Same template + user (or recipient) + dedupeKey gives the same key, so retries and duplicate webhooks collapse. */
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

    // Render before the config check so template bugs also fail in dev, where there is no API key.
    const rendered = await renderTemplate(template, props, brand)

    const email: OutboundEmail = {
      to: recipient,
      from: this.config.from,
      replyTo: options?.replyTo ?? this.config.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        // Stops out-of-office auto-replies to transactional mail.
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
  /** Startup notes from `loadEmailConfig`, logged once here. */
  warnings?: string[]
  /** Replaces the transport entirely (tests, HTML export script). */
  transport?: EmailTransport
  retryDeps?: RetryDeps
}

/** Uses Resend when an API key is set, otherwise a no-op in-memory recorder. */
export function createEmailService(options: CreateEmailServiceOptions): EmailService {
  options.warnings?.forEach((warning) => console.warn(`[email] ${warning}`))

  const transport =
    options.transport ??
    (options.config.apiKey !== undefined
      ? createResendTransport({ apiKey: options.config.apiKey })
      : createInMemoryTransport('noop'))

  return new EmailService({ transport, config: options.config, retryDeps: options.retryDeps })
}
