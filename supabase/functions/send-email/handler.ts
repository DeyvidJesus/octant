// send-email: lets a signed-in user trigger an allowlisted email by `{ intent }`. The recipient always comes
// from the verified JWT, never the body, so this can't become an open relay.

import { SecurityAlertKind, displayNameFrom, formatDateTime } from '@octant/email'
import { createAdminClient, createUserClient } from '../_shared/admin.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { preferencesUrlFor, sendLogged } from '../_shared/mailer.ts'

// Only templates whose props can be derived entirely from the verified session belong here.
const INTENTS = {
  /** Sent once, after the address is confirmed. */
  Welcome: 'welcome',
  /** Follows a successful `auth.updateUser({ password })`. */
  PasswordChanged: 'password-changed',
  /** New-device acknowledgement. */
  SecurityAlert: 'security-alert',
} as const

type Intent = (typeof INTENTS)[keyof typeof INTENTS]

const ALLOWED_INTENTS = new Set<string>(Object.values(INTENTS))

interface RequestBody {
  intent?: string
}

// No "email changed" intent: it would need a recipient from the body. auth-email-hook covers the old
// address via `email_change_current`.

Deno.serve(async (req: Request): Promise<Response> => {
  const CORS = corsHeaders(req)
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  // The verified JWT is what makes the recipient trustworthy.
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
    // A missing public key is server misconfiguration, not a bad token, so not a 401.
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
          // No dedupeKey: the default per-user key makes welcome a once-ever email.
        })

      case INTENTS.PasswordChanged:
        return sendLogged(admin, {
          ...shared,
          template: 'password-changed',
          to: recipient,
          props: { name, occurredAt, ipAddress, userAgent },
          // Keyed to the update timestamp: each real change notifies, a double-submit doesn't.
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
    // 502: the request was valid; the email provider failed.
    return json({ error: 'Could not send the email.', code: outcome.code }, 502)
  }

  return json({ status: outcome.status })
})
