// Pure mapping from a Stripe event to a template and props, typed structurally so there is no Stripe SDK
// dependency; real `Stripe.Subscription` / `Stripe.Invoice` objects fit these shapes.

import { daysBetween, formatDate, formatMoney, type FormattingOptions } from '../formatting.ts'
import type { TemplateDefinitions, TemplateName } from '../templates/props.ts'

/** Stripe event types the billing webhook must subscribe to for these emails to fire. */
export const BillingEvent = {
  SubscriptionCreated: 'customer.subscription.created',
  SubscriptionUpdated: 'customer.subscription.updated',
  SubscriptionDeleted: 'customer.subscription.deleted',
  TrialWillEnd: 'customer.subscription.trial_will_end',
  InvoicePaid: 'invoice.payment_succeeded',
  InvoiceFailed: 'invoice.payment_failed',
} as const

export type BillingEventValue = (typeof BillingEvent)[keyof typeof BillingEvent]

/** Every event type that must be enabled on the Stripe endpoint. */
export const BILLING_EVENT_TYPES: BillingEventValue[] = Object.values(BillingEvent)

export interface StripeSubscriptionLike {
  id: string
  status?: string | null
  trial_end?: number | null
  current_period_end?: number | null
  cancel_at_period_end?: boolean | null
  metadata?: Record<string, string> | null
  items?: {
    data?: Array<{
      price?: {
        nickname?: string | null
        unit_amount?: number | null
        currency?: string | null
        recurring?: { interval?: string | null } | null
      } | null
    }>
  } | null
}

export interface StripeInvoiceLike {
  id?: string
  number?: string | null
  amount_due?: number | null
  amount_paid?: number | null
  currency?: string | null
  hosted_invoice_url?: string | null
  next_payment_attempt?: number | null
  period_end?: number | null
  subscription?: string | { id: string } | null
  lines?: {
    data?: Array<{ price?: { nickname?: string | null } | null }>
  } | null
  last_finalization_error?: { message?: string | null } | null
}

/** `previous_attributes` on a `.updated` event is the only way to know what changed. */
export interface StripeEventLike {
  type: string
  data: {
    object: StripeSubscriptionLike | StripeInvoiceLike
    previous_attributes?: Record<string, unknown> | null
  }
}

export interface BillingEmailContext extends FormattingOptions {
  /** Fallback plan label when Stripe's price has no nickname. */
  defaultPlanName?: string
  /** "Now" in Unix seconds, injected so `daysBetween` is deterministic in tests. */
  nowUnixSeconds: number
  /** Days of access after a failed payment, for the payment-failed copy. */
  gracePeriodDays?: number
  /** Recipient name, resolved from auth by the caller. */
  name?: string
}

export interface MappedBillingEmail<N extends TemplateName = TemplateName> {
  template: N
  props: TemplateDefinitions[N]
  /** Keys the send to this specific Stripe object, so a webhook replay cannot double-send. */
  dedupeKey: string
}

/** Statuses that mean the subscription is no longer paying. */
const LAPSED_STATUSES = new Set(['past_due', 'canceled', 'unpaid', 'incomplete_expired'])

function planNameFrom(subscription: StripeSubscriptionLike, fallback: string): string {
  return subscription.items?.data?.[0]?.price?.nickname?.trim() ?? fallback
}

function priceFrom(subscription: StripeSubscriptionLike, options: FormattingOptions) {
  const price = subscription.items?.data?.[0]?.price
  return {
    amountFormatted: formatMoney(price?.unit_amount, price?.currency, options),
    interval: price?.recurring?.interval ?? undefined,
  }
}

/** Reads the user id the checkout session stamped onto the subscription's metadata. */
export function userIdFromSubscription(subscription: StripeSubscriptionLike): string | undefined {
  const value = subscription.metadata?.user_id
  return value !== undefined && value !== '' ? value : undefined
}

/** Returns `null` for events that need no email (most `.updated` events); the caller still upserts its row. */
export function mapBillingEmail(
  event: StripeEventLike,
  context: BillingEmailContext,
): MappedBillingEmail | null {
  const fallbackPlan = context.defaultPlanName ?? 'Pro'
  const formatting: FormattingOptions = { locale: context.locale, timeZone: context.timeZone }
  const { name } = context

  switch (event.type) {
    case BillingEvent.SubscriptionCreated: {
      const subscription = event.data.object as StripeSubscriptionLike
      const { amountFormatted, interval } = priceFrom(subscription, formatting)
      // A subscription that starts in trial gets the trial emails, not a "you're on Pro" receipt.
      if (subscription.status === 'trialing') return null
      return {
        template: 'subscription-created',
        dedupeKey: `created:${subscription.id}`,
        props: {
          name,
          planName: planNameFrom(subscription, fallbackPlan),
          amountFormatted,
          interval,
          renewsOn: formatDate(subscription.current_period_end, formatting),
        },
      }
    }

    case BillingEvent.SubscriptionDeleted: {
      const subscription = event.data.object as StripeSubscriptionLike
      return {
        template: 'subscription-cancelled',
        dedupeKey: `cancelled:${subscription.id}`,
        props: {
          name,
          planName: planNameFrom(subscription, fallbackPlan),
          // Only mention retained access if the period hasn't elapsed yet.
          accessUntil:
            subscription.current_period_end !== null &&
            subscription.current_period_end !== undefined &&
            subscription.current_period_end > context.nowUnixSeconds
              ? formatDate(subscription.current_period_end, formatting)
              : undefined,
        },
      }
    }

    case BillingEvent.TrialWillEnd: {
      const subscription = event.data.object as StripeSubscriptionLike
      const trialEnd = subscription.trial_end
      if (trialEnd === null || trialEnd === undefined) return null
      return {
        template: 'trial-ending',
        dedupeKey: `trial-ending:${subscription.id}:${trialEnd}`,
        props: {
          name,
          planName: planNameFrom(subscription, fallbackPlan),
          daysRemaining: daysBetween(context.nowUnixSeconds, trialEnd),
          // `formatDate` only returns undefined for non-finite input, which is excluded above.
          trialEndsOn: formatDate(trialEnd, formatting) ?? '',
        },
      }
    }

    case BillingEvent.SubscriptionUpdated: {
      const subscription = event.data.object as StripeSubscriptionLike
      const previousStatus = event.data.previous_attributes?.status
      // Only email when a trial ended without converting; other transitions have dedicated events.
      const leftTrial = previousStatus === 'trialing'
      const nowLapsed = LAPSED_STATUSES.has(subscription.status ?? '')
      if (!leftTrial || !nowLapsed) return null
      return {
        template: 'trial-expired',
        dedupeKey: `trial-expired:${subscription.id}`,
        props: { name, planName: planNameFrom(subscription, fallbackPlan) },
      }
    }

    case BillingEvent.InvoicePaid: {
      const invoice = event.data.object as StripeInvoiceLike
      const amountFormatted = formatMoney(invoice.amount_paid, invoice.currency, formatting)
      // A zero-amount invoice (100% coupon, trial conversion) is not a receipt worth sending.
      if (amountFormatted === undefined || (invoice.amount_paid ?? 0) <= 0) return null
      return {
        template: 'billing-success',
        dedupeKey: `paid:${invoice.id ?? 'unknown'}`,
        props: {
          name,
          planName: invoice.lines?.data?.[0]?.price?.nickname?.trim() ?? fallbackPlan,
          amountFormatted,
          invoiceNumber: invoice.number ?? undefined,
          invoiceUrl: invoice.hosted_invoice_url ?? undefined,
          periodEnd: formatDate(invoice.period_end, formatting),
        },
      }
    }

    case BillingEvent.InvoiceFailed: {
      const invoice = event.data.object as StripeInvoiceLike
      return {
        template: 'payment-failed',
        dedupeKey: `failed:${invoice.id ?? 'unknown'}:${invoice.next_payment_attempt ?? 0}`,
        props: {
          name,
          amountFormatted: formatMoney(invoice.amount_due, invoice.currency, formatting),
          reason: invoice.last_finalization_error?.message ?? undefined,
          nextAttemptOn: formatDate(invoice.next_payment_attempt, formatting),
          gracePeriodDays: context.gracePeriodDays,
        },
      }
    }

    default:
      return null
  }
}
