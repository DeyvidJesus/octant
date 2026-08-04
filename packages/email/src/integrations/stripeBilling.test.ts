import { describe, expect, it } from 'vitest'
import {
  BILLING_EVENT_TYPES,
  BillingEvent,
  mapBillingEmail,
  userIdFromSubscription,
  type BillingEmailContext,
  type StripeEventLike,
  type StripeInvoiceLike,
  type StripeSubscriptionLike,
} from './stripeBilling.ts'
import { propsOf } from './testHelpers.ts'

/** 4 Aug 2026, 00:00 UTC. */
const NOW = 1_785_801_600

const CONTEXT: BillingEmailContext = {
  nowUnixSeconds: NOW,
  defaultPlanName: 'Pro',
  gracePeriodDays: 7,
  name: 'Ana',
  locale: 'en-US',
  timeZone: 'UTC',
}

const DAY = 86_400

function subscription(overrides?: Partial<StripeSubscriptionLike>): StripeSubscriptionLike {
  return {
    id: 'sub_123',
    status: 'active',
    current_period_end: NOW + 30 * DAY,
    metadata: { user_id: 'user-1' },
    items: {
      data: [
        {
          price: { nickname: 'Pro', unit_amount: 4900, currency: 'brl', recurring: { interval: 'month' } },
        },
      ],
    },
    ...overrides,
  }
}

function invoice(overrides?: Partial<StripeInvoiceLike>): StripeInvoiceLike {
  return {
    id: 'in_123',
    number: 'B1C2D3-0007',
    amount_paid: 4900,
    amount_due: 4900,
    currency: 'brl',
    period_end: NOW + 30 * DAY,
    hosted_invoice_url: 'https://invoice.stripe.com/i/abc',
    ...overrides,
  }
}

function event(type: string, object: StripeSubscriptionLike | StripeInvoiceLike, previous?: Record<string, unknown>): StripeEventLike {
  return { type, data: { object, previous_attributes: previous } }
}

describe('BILLING_EVENT_TYPES', () => {
  it('lists exactly the events the Stripe endpoint must enable', () => {
    // This array is what the manual setup checklist and the webhook's handler table are built from —
    // if they drift, emails silently stop firing.
    expect(BILLING_EVENT_TYPES).toEqual([
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'customer.subscription.trial_will_end',
      'invoice.payment_succeeded',
      'invoice.payment_failed',
    ])
  })
})

describe('userIdFromSubscription', () => {
  it('reads the id that checkout stamped onto metadata', () => {
    expect(userIdFromSubscription(subscription())).toBe('user-1')
  })

  it('returns undefined when absent or blank', () => {
    expect(userIdFromSubscription(subscription({ metadata: {} }))).toBeUndefined()
    expect(userIdFromSubscription(subscription({ metadata: { user_id: '' } }))).toBeUndefined()
    expect(userIdFromSubscription(subscription({ metadata: null }))).toBeUndefined()
  })
})

describe('mapBillingEmail — subscription created', () => {
  it('maps to subscription-created with plan, price and renewal date', () => {
    const result = mapBillingEmail(event(BillingEvent.SubscriptionCreated, subscription()), CONTEXT)
    expect(result?.template).toBe('subscription-created')
    expect(result?.props).toMatchObject({
      name: 'Ana',
      planName: 'Pro',
      amountFormatted: 'R$49.00',
      interval: 'month',
      renewsOn: 'Sep 3, 2026',
    })
  })

  it('stays silent when the subscription starts in trial — the trial emails own that story', () => {
    const result = mapBillingEmail(
      event(BillingEvent.SubscriptionCreated, subscription({ status: 'trialing' })),
      CONTEXT,
    )
    expect(result).toBeNull()
  })

  it('falls back to the default plan name when the price has no nickname', () => {
    const withoutNickname = subscription({
      items: { data: [{ price: { nickname: null, unit_amount: 4900, currency: 'brl', recurring: { interval: 'month' } } }] },
    })
    const result = mapBillingEmail(event(BillingEvent.SubscriptionCreated, withoutNickname), CONTEXT)
    expect(propsOf<{ planName: string }>(result).planName).toBe('Pro')
  })
})

describe('mapBillingEmail — subscription deleted', () => {
  it('claims retained access only while the paid period is still running', () => {
    const result = mapBillingEmail(event(BillingEvent.SubscriptionDeleted, subscription()), CONTEXT)
    expect(result?.template).toBe('subscription-cancelled')
    expect(propsOf<{ accessUntil?: string }>(result).accessUntil).toBe('Sep 3, 2026')
  })

  it('omits accessUntil when the period has already elapsed', () => {
    const result = mapBillingEmail(
      event(BillingEvent.SubscriptionDeleted, subscription({ current_period_end: NOW - DAY })),
      CONTEXT,
    )
    expect(propsOf<{ accessUntil?: string }>(result).accessUntil).toBeUndefined()
  })
})

describe('mapBillingEmail — trials', () => {
  it('maps trial_will_end to trial-ending with the correct day count', () => {
    const result = mapBillingEmail(
      event(BillingEvent.TrialWillEnd, subscription({ status: 'trialing', trial_end: NOW + 3 * DAY })),
      CONTEXT,
    )
    expect(result?.template).toBe('trial-ending')
    expect(result?.props).toMatchObject({ daysRemaining: 3, trialEndsOn: 'Aug 7, 2026' })
  })

  it('skips trial_will_end with no trial_end to report', () => {
    expect(
      mapBillingEmail(event(BillingEvent.TrialWillEnd, subscription({ trial_end: null })), CONTEXT),
    ).toBeNull()
  })

  it('maps a trialing→past_due update to trial-expired', () => {
    const result = mapBillingEmail(
      event(BillingEvent.SubscriptionUpdated, subscription({ status: 'past_due' }), { status: 'trialing' }),
      CONTEXT,
    )
    expect(result?.template).toBe('trial-expired')
    expect(result?.props).toMatchObject({ planName: 'Pro' })
  })

  it.each(['canceled', 'unpaid', 'incomplete_expired'])('treats %s as a lapsed trial too', (status) => {
    const result = mapBillingEmail(
      event(BillingEvent.SubscriptionUpdated, subscription({ status }), { status: 'trialing' }),
      CONTEXT,
    )
    expect(result?.template).toBe('trial-expired')
  })

  it('stays silent on a trial that converted successfully', () => {
    const result = mapBillingEmail(
      event(BillingEvent.SubscriptionUpdated, subscription({ status: 'active' }), { status: 'trialing' }),
      CONTEXT,
    )
    expect(result).toBeNull()
  })

  it('stays silent on routine updates — a renewal must not email the customer', () => {
    expect(
      mapBillingEmail(
        event(BillingEvent.SubscriptionUpdated, subscription(), { current_period_end: NOW }),
        CONTEXT,
      ),
    ).toBeNull()
    expect(
      mapBillingEmail(event(BillingEvent.SubscriptionUpdated, subscription({ status: 'past_due' }), { status: 'active' }), CONTEXT),
    ).toBeNull()
  })
})

describe('mapBillingEmail — invoices', () => {
  it('maps a paid invoice to a receipt', () => {
    const result = mapBillingEmail(event(BillingEvent.InvoicePaid, invoice()), CONTEXT)
    expect(result?.template).toBe('billing-success')
    expect(result?.props).toMatchObject({
      amountFormatted: 'R$49.00',
      invoiceNumber: 'B1C2D3-0007',
      invoiceUrl: 'https://invoice.stripe.com/i/abc',
      periodEnd: 'Sep 3, 2026',
    })
  })

  it('skips a zero-amount invoice — a 100%-coupon charge is not a receipt', () => {
    expect(mapBillingEmail(event(BillingEvent.InvoicePaid, invoice({ amount_paid: 0 })), CONTEXT)).toBeNull()
  })

  it('maps a failed payment with reason, retry date and grace period', () => {
    const result = mapBillingEmail(
      event(
        BillingEvent.InvoiceFailed,
        invoice({
          next_payment_attempt: NOW + 3 * DAY,
          last_finalization_error: { message: 'Your card was declined' },
        }),
      ),
      CONTEXT,
    )
    expect(result?.template).toBe('payment-failed')
    expect(result?.props).toMatchObject({
      amountFormatted: 'R$49.00',
      reason: 'Your card was declined',
      nextAttemptOn: 'Aug 7, 2026',
      gracePeriodDays: 7,
    })
  })

  it('still sends payment-failed when Stripe gives no reason', () => {
    const result = mapBillingEmail(event(BillingEvent.InvoiceFailed, invoice()), CONTEXT)
    expect(result?.template).toBe('payment-failed')
    expect(propsOf<{ reason?: string }>(result).reason).toBeUndefined()
  })
})

describe('mapBillingEmail — de-duplication', () => {
  it('keys on the Stripe object so a webhook replay cannot double-send', () => {
    const a = mapBillingEmail(event(BillingEvent.SubscriptionCreated, subscription()), CONTEXT)
    const b = mapBillingEmail(event(BillingEvent.SubscriptionCreated, subscription()), CONTEXT)
    expect(a?.dedupeKey).toBe(b?.dedupeKey)
  })

  it('separates distinct retry attempts of the same invoice', () => {
    const first = mapBillingEmail(
      event(BillingEvent.InvoiceFailed, invoice({ next_payment_attempt: NOW + DAY })),
      CONTEXT,
    )
    const second = mapBillingEmail(
      event(BillingEvent.InvoiceFailed, invoice({ next_payment_attempt: NOW + 4 * DAY })),
      CONTEXT,
    )
    expect(first?.dedupeKey).not.toBe(second?.dedupeKey)
  })

  it('separates each trial-ending notice per trial end date', () => {
    const first = mapBillingEmail(
      event(BillingEvent.TrialWillEnd, subscription({ trial_end: NOW + 3 * DAY })),
      CONTEXT,
    )
    const extended = mapBillingEmail(
      event(BillingEvent.TrialWillEnd, subscription({ trial_end: NOW + 10 * DAY })),
      CONTEXT,
    )
    expect(first?.dedupeKey).not.toBe(extended?.dedupeKey)
  })
})

describe('mapBillingEmail — irrelevant events', () => {
  it('returns null so the caller can still do its database work and ack', () => {
    expect(mapBillingEmail(event('customer.created', subscription()), CONTEXT)).toBeNull()
    expect(mapBillingEmail(event('invoice.upcoming', invoice()), CONTEXT)).toBeNull()
  })
})
