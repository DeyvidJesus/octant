/**
 * Supabase Auth "Send Email Hook" → template + props.
 *
 * Lives in this package, not in the Edge Function, for one reason: it is pure, and pure code can be
 * tested. Edge Functions run under Deno and are excluded from the vitest suite, so any logic left inside
 * one is effectively untested. The function keeps only what genuinely needs a runtime — signature
 * verification, HTTP, logging.
 *
 * A single hook covers six of the fourteen templates. GoTrue calls it INSTEAD of sending its own email,
 * so enabling the hook replaces every default auth template at once.
 *
 * The verification URL points at GoTrue's own `/auth/v1/verify` endpoint rather than at the app: GoTrue
 * validates the token hash, establishes the session, and only then redirects to `redirect_to`. Building
 * an app-side URL instead would mean reimplementing token verification in the client.
 *
 * @see https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
 */

import { SecurityAlertKind } from '../templates/props.ts'
import type { TemplateDefinitions, TemplateName } from '../templates/props.ts'

/** The `email_action_type` values GoTrue sends. */
export const AuthEmailAction = {
  Signup: 'signup',
  Recovery: 'recovery',
  MagicLink: 'magiclink',
  Invite: 'invite',
  EmailChange: 'email_change',
  /** Sent to the address being LEFT, when "secure email change" is enabled. */
  EmailChangeCurrent: 'email_change_current',
  /** Sent to the address being ADOPTED. */
  EmailChangeNew: 'email_change_new',
  Reauthentication: 'reauthentication',
} as const

export type AuthEmailActionValue = (typeof AuthEmailAction)[keyof typeof AuthEmailAction]

/** Structural subset of the hook payload — only the fields this mapping reads. */
export interface AuthHookPayload {
  user: {
    id: string
    email?: string | null
    new_email?: string | null
    user_metadata?: Record<string, unknown> | null
  }
  email_data: {
    token?: string
    token_hash?: string
    token_new?: string
    token_hash_new?: string
    redirect_to?: string
    email_action_type?: string
    site_url?: string
  }
}

export interface AuthEmailContext {
  /** The Supabase project URL, e.g. `https://abc.supabase.co`. Verification links are built from it. */
  supabaseUrl: string
  /** Fallback destination when the hook payload carries no `redirect_to`. */
  defaultRedirectTo: string
  /** Pre-formatted "now", supplied by the caller so this function stays pure and testable. */
  occurredAt?: string
  ipAddress?: string
  userAgent?: string
}

/** One mapped send: everything the caller needs to hand to `EmailService.send`. */
export interface MappedAuthEmail<N extends TemplateName = TemplateName> {
  template: N
  to: string
  props: TemplateDefinitions[N]
  /** Distinguishes separate requests of the same kind, so a second reset isn't swallowed as a duplicate. */
  dedupeKey: string
  userId: string
}

/** How long each kind of link stays valid, for the copy in the email. Matches GoTrue's defaults. */
const EXPIRY_MINUTES: Partial<Record<AuthEmailActionValue, number>> = {
  [AuthEmailAction.Signup]: 60 * 24,
  [AuthEmailAction.Recovery]: 60,
  [AuthEmailAction.MagicLink]: 60,
  [AuthEmailAction.Invite]: 60 * 24 * 7,
  [AuthEmailAction.EmailChange]: 60 * 24,
  [AuthEmailAction.EmailChangeNew]: 60 * 24,
}

/** Best-effort display name from user metadata. GoTrue puts whatever signup passed in here. */
export function displayNameFrom(metadata?: Record<string, unknown> | null): string | undefined {
  if (metadata === null || metadata === undefined) return undefined
  for (const key of ['name', 'full_name', 'first_name', 'display_name']) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

/**
 * Builds GoTrue's verification URL.
 *
 * `redirect_to` is passed through rather than overridden so that Supabase's own redirect allowlist stays
 * the control point — an attacker-supplied value is rejected by GoTrue, not silently trusted here.
 */
export function buildVerificationUrl(input: {
  supabaseUrl: string
  tokenHash: string
  actionType: string
  redirectTo: string
}): string {
  const base = input.supabaseUrl.replace(/\/+$/, '')
  const params = new URLSearchParams({
    token: input.tokenHash,
    type: input.actionType,
    redirect_to: input.redirectTo,
  })
  return `${base}/auth/v1/verify?${params.toString()}`
}

/**
 * Maps a hook payload to a template and its props.
 *
 * Returns `null` for an action we deliberately don't send (nothing is silently dropped: the caller logs
 * and acknowledges, so GoTrue doesn't retry forever). Throws only when the payload is unusable.
 */
export function mapAuthEmail(payload: AuthHookPayload, context: AuthEmailContext): MappedAuthEmail | null {
  const action = payload.email_data.email_action_type
  if (action === undefined || action === '') return null

  const redirectTo = payload.email_data.redirect_to ?? context.defaultRedirectTo
  const name = displayNameFrom(payload.user.user_metadata)
  const currentEmail = payload.user.email?.trim() ?? ''
  const newEmail = payload.user.new_email?.trim() ?? ''
  const expiresInMinutes = EXPIRY_MINUTES[action as AuthEmailActionValue]

  /** Verification link for the primary token, given the action GoTrue should verify it against. */
  const linkFor = (actionType: string, useNewToken = false): string => {
    const tokenHash = useNewToken
      ? (payload.email_data.token_hash_new ?? payload.email_data.token_hash ?? '')
      : (payload.email_data.token_hash ?? '')
    return buildVerificationUrl({
      supabaseUrl: context.supabaseUrl,
      tokenHash,
      actionType,
      redirectTo,
    })
  }

  // The token hash is what makes the link work; without one there is nothing worth sending.
  const hasToken =
    (payload.email_data.token_hash ?? '') !== '' || (payload.email_data.token_hash_new ?? '') !== ''
  if (!hasToken) return null

  const base = { userId: payload.user.id, dedupeKey: payload.email_data.token_hash ?? action }

  switch (action) {
    case AuthEmailAction.Signup:
      if (currentEmail === '') return null
      return {
        ...base,
        template: 'verify-email',
        to: currentEmail,
        props: { name, verifyUrl: linkFor(action), token: payload.email_data.token, expiresInMinutes },
      }

    case AuthEmailAction.Recovery:
      if (currentEmail === '') return null
      return {
        ...base,
        template: 'password-reset',
        to: currentEmail,
        props: {
          name,
          resetUrl: linkFor(action),
          token: payload.email_data.token,
          expiresInMinutes,
          occurredAt: context.occurredAt,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }

    case AuthEmailAction.MagicLink:
      if (currentEmail === '') return null
      return {
        ...base,
        template: 'magic-link',
        to: currentEmail,
        props: {
          name,
          magicLinkUrl: linkFor(action),
          token: payload.email_data.token,
          expiresInMinutes,
        },
      }

    case AuthEmailAction.Invite:
      if (currentEmail === '') return null
      return {
        ...base,
        template: 'invitation',
        to: currentEmail,
        props: { inviteUrl: linkFor(action), expiresInDays: 7 },
      }

    // The address being ADOPTED gets the confirmation link. `email_change` is the single-confirmation
    // variant; `email_change_new` is the second half of the secure two-step flow.
    case AuthEmailAction.EmailChange:
    case AuthEmailAction.EmailChangeNew: {
      const recipient = newEmail !== '' ? newEmail : currentEmail
      if (recipient === '') return null
      return {
        ...base,
        template: 'email-changed',
        to: recipient,
        props: {
          name,
          newEmail: recipient,
          oldEmail: newEmail !== '' ? currentEmail : undefined,
          confirmUrl: linkFor('email_change', action === AuthEmailAction.EmailChangeNew),
          occurredAt: context.occurredAt,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }
    }

    // The address being LEFT gets a notice with NO confirmation link — it is the takeover tripwire, and
    // handing it a working link would let an attacker complete the change from the inbox they stole.
    case AuthEmailAction.EmailChangeCurrent: {
      if (currentEmail === '') return null
      return {
        ...base,
        template: 'email-changed',
        to: currentEmail,
        props: {
          name,
          newEmail: newEmail !== '' ? newEmail : currentEmail,
          oldEmail: currentEmail,
          occurredAt: context.occurredAt,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }
    }

    case AuthEmailAction.Reauthentication: {
      if (currentEmail === '') return null
      const code = payload.email_data.token
      if (code === undefined || code === '') return null
      return {
        ...base,
        template: 'security-alert',
        to: currentEmail,
        props: {
          name,
          kind: SecurityAlertKind.Reauthentication,
          code,
          occurredAt: context.occurredAt,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }
    }

    default:
      // An action type we don't recognise (a future GoTrue addition). Returning null lets the caller
      // acknowledge the hook rather than 500 and block the user's auth flow entirely.
      return null
  }
}
