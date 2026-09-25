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


import { SecurityAlertKind, displayNameFrom, formatDateTime } from '@octant/email'
import { createAdminClient, createUserClient } from '../_shared/admin.ts'
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
  /** User-initiated "this wasn't me" / new-device acknowledgement. */
  SecurityAlert: 'security-alert',
} as const

type Intent = (typeof INTENTS)[keyof typeof INTENTS]

const ALLOWED_INTENTS = new Set<string>(Object.values(INTENTS))

interface RequestBody {
  intent?: string
}

// There is deliberately no "email changed" notice here. It would have to be sent to the PREVIOUS
// address, which the session can no longer vouch for, so the body would have to name the recipient,
// which is exactly the open relay the rules above forbid. The old inbox is covered by Supabase Auth's
// secure email change instead: `auth-email-hook` mails the current address on `email_change_current`.

Deno.serve(async (req: Request): Promise<Response> => {
  const CORS = corsHeaders(req)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // Verify the caller's Supabase JWT — this is what makes the recipient trustworthy.
  const authHeader = req.headers.get('Authorization')
  if (authHeader === null) return json({ error: 'Missing authorization header.' }, 401)

  let user
  try {
    const supabase = createUserClient(authHeader)
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError !== null || data.user === null) {
      return json({ error: 'Invalid or expired session.' }, 401)
    }
    user = data.user
  } catch (err) {
    // A missing public key is server misconfiguration, not a bad token — don't report it as a 401.
    console.error(`[send-email] ${err instanceof Error ? err.message : String(err)}`)
    return json({ error: 'Email is not configured on the server.' }, 500)
  }

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

  let admin
  try {
    admin = createAdminClient()
  } catch (err) {
    console.error(`[send-email] ${err instanceof Error ? err.message : String(err)}`)
    return json({ error: 'Email is not configured on the server.' }, 500)
  }

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
