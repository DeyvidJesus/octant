// Supabase Edge Function: send-email
//
// Phase 15 — the ONE endpoint the browser may use to trigger an email. It exists for the messages that
// have no provider webhook behind them: the welcome email, and the account-security notices that follow
// a password or email change.
//
// SECURITY MODEL — this is the whole reason the function is shaped this way:
//
//   * The client sends only `{ intent }` from a fixed allowlist. It cannot choose a template, a subject,
//     a body, or any prop.
//   * The recipient is ALWAYS `user.email` from the verified JWT. It is never read from the request body.
//     Without that rule this endpoint would be an open relay: any signed-in user could have branded
//     Octant email delivered to any address they liked.
//   * Props are assembled server-side from the verified session and the request headers.
//
// Idempotency is enforced by `email_log.idempotency_key` (see `_shared/mailer.ts`), so a double-clicked
// button or a re-mounted React effect cannot send twice.
//
// Source of truth: edit `handler.ts`, then run `yarn build:functions` to regenerate `index.ts`.
//
// Deploy:  yarn build:functions && supabase functions deploy send-email
//          (JWT verification stays ON — the caller must be a signed-in user.)
// Secrets: RESEND_API_KEY, EMAIL_FROM, APP_URL (shared with the other email functions).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SecurityAlertKind, displayNameFrom, formatDateTime } from '@octant/email'
import { corsHeaders } from '../_shared/cors.ts'
import { preferencesUrlFor, sendLogged } from '../_shared/mailer.ts'

/**
 * The intents a browser may trigger. Each maps to a template whose entire payload can be derived from
 * the verified session — that derivability is the criterion for being on this list. Anything needing
 * caller-supplied content (an invitation, a billing receipt) belongs to a webhook, not here.
 */
const INTENTS = {
  /** Sent once, after the address is confirmed. */
  Welcome: 'welcome',
  /** Follows a successful `auth.updateUser({ password })`. */
  PasswordChanged: 'password-changed',
  /** Courtesy notice to the address a user just moved AWAY from. */
  EmailChangedNotice: 'email-changed-notice',
  /** User-initiated "this wasn't me" / new-device acknowledgement. */
  SecurityAlert: 'security-alert',
} as const

type Intent = (typeof INTENTS)[keyof typeof INTENTS]

const ALLOWED_INTENTS = new Set<string>(Object.values(INTENTS))

interface RequestBody {
  intent?: string
  /**
   * The ONLY caller-supplied value that is honoured, and only for `email-changed-notice`: the address
   * being moved away from, which by definition is no longer on the account and so cannot be read from
   * the session. Validated below, and used solely as display copy — never as the recipient.
   */
  previousEmail?: string
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

Deno.serve(async (req: Request): Promise<Response> => {
  const CORS = corsHeaders(req)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // Verify the caller's Supabase JWT — this is what makes the recipient trustworthy.
  const authHeader = req.headers.get('Authorization')
  if (authHeader === null) return json({ error: 'Missing authorization header.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError !== null || user === null) return json({ error: 'Invalid or expired session.' }, 401)

  const recipient = user.email ?? ''
  if (recipient === '') return json({ error: 'Your account has no email address.' }, 400)

  let body: RequestBody = {}
  try {
    body = (await req.json()) as RequestBody
  } catch {
    // An empty body is fine; `intent` is validated next either way.
  }

  const intent = body.intent ?? ''
  if (!ALLOWED_INTENTS.has(intent)) {
    return json({ error: `Unsupported intent "${intent}".` }, 400)
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  })

  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')
  const name = displayNameFrom(user.user_metadata as Record<string, unknown> | null)
  const occurredAt = formatDateTime(new Date().toISOString())
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined
  const userAgent = req.headers.get('user-agent') ?? undefined
  const preferencesUrl = await preferencesUrlFor(admin, user.id, appUrl)

  const shared = { userId: user.id, preferencesUrl, metadata: { source: 'send-email', intent } }

  const outcome = await (async () => {
    switch (intent as Intent) {
      case INTENTS.Welcome:
        return sendLogged(admin, {
          ...shared,
          template: 'welcome',
          to: recipient,
          props: { name },
          // No dedupeKey: the welcome email is once-per-user for all time, so the default key (which is
          // derived from userId alone) is exactly the guard we want.
        })

      case INTENTS.PasswordChanged:
        return sendLogged(admin, {
          ...shared,
          template: 'password-changed',
          to: recipient,
          props: { name, occurredAt, ipAddress, userAgent },
          // Keyed to the account's current password timestamp so each genuine change notifies, while a
          // double-submit of the same change does not.
          dedupeKey: `pwd:${user.updated_at ?? occurredAt ?? ''}`,
        })

      case INTENTS.EmailChangedNotice: {
        const previousEmail = body.previousEmail?.trim()
        if (previousEmail === undefined || !EMAIL_PATTERN.test(previousEmail)) {
          return { status: 'failed' as const, code: 'EMAIL_VALIDATION', message: 'previousEmail is not a valid address.' }
        }
        return sendLogged(admin, {
          ...shared,
          // Goes to the OLD address — the only inbox that can catch an unauthorised change. Sending it
          // is safe because the address is not the recipient of anything else, and the template
          // deliberately carries no confirmation link.
          template: 'email-changed',
          to: previousEmail,
          props: { name, newEmail: recipient, oldEmail: previousEmail, occurredAt, ipAddress, userAgent },
          dedupeKey: `email-change:${previousEmail}:${recipient}`,
        })
      }

      case INTENTS.SecurityAlert:
        return sendLogged(admin, {
          ...shared,
          template: 'security-alert',
          to: recipient,
          props: {
            name,
            kind: SecurityAlertKind.NewDevice,
            occurredAt,
            ipAddress,
            userAgent,
            secureAccountUrl: `${appUrl}/settings`,
          },
          dedupeKey: `security:${ipAddress ?? 'unknown'}:${userAgent ?? 'unknown'}`,
        })
    }
  })()

  if (outcome.status === 'failed') {
    // 502: the request was valid, the downstream provider was not.
    return json({ error: 'Could not send the email.', code: outcome.code }, 502)
  }

  return json({ status: outcome.status })
})
