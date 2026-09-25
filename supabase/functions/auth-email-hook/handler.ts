// auth-email-hook: GoTrue Send Email Hook; verifies the Standard Webhooks signature and sends auth emails.
// Deploy with --no-verify-jwt (GoTrue doesn't send a JWT); `yarn build:functions` regenerates index.ts.

// The bundler pins this bare specifier to the version in the root package.json.
import { Webhook } from 'standardwebhooks'
import { formatDateTime, mapAuthEmail, type AuthHookPayload } from '@octant/email'
import { createAdminClient } from '../_shared/admin.ts'
import { sendLogged } from '../_shared/mailer.ts'

// Business errors go back as HTTP 200 with `error.http_code`; on any other status GoTrue drops the body
// and logs only "Unexpected status code returned from hook".
function hookError(message: string, httpCode: number): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

/** Real HTTP status for requests that aren't a valid GoTrue call, such as a bad signature. */
function transportError(message: string, httpCode: number): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { 'content-type': 'application/json' },
  })
}

/** Empty JSON with 200 tells GoTrue the email was handled. */
function hookOk(): Response {
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return transportError('Method not allowed.', 405)

  const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (rawSecret === undefined || rawSecret === '') {
    console.error('[auth-email-hook] SEND_EMAIL_HOOK_SECRET is not set — refusing to process the hook.')
    return hookError('Email hook is not configured.', 500)
  }

  const body = await req.text()

  // Verify before parsing. The secret is `v1,whsec_...`; the library strips `whsec_`, so drop only `v1,`.
  let payload: AuthHookPayload
  try {
    const headers: Record<string, string> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })
    const webhook = new Webhook(rawSecret.replace(/^v1,/, ''))
    payload = webhook.verify(body, headers) as AuthHookPayload
  } catch (err) {
    console.error(`[auth-email-hook] signature verification failed: ${String(err)}`)
    return transportError('Invalid hook signature.', 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')
  if (supabaseUrl === '') return hookError('Server is missing SUPABASE_URL.', 500)

  const mapped = mapAuthEmail(payload, {
    supabaseUrl,
    defaultRedirectTo: `${appUrl}/auth/callback`,
    // Computed here so the mapper stays clock-free and testable.
    occurredAt: formatDateTime(new Date().toISOString()),
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  if (mapped === null) {
    // Unknown action: log it but ack, since failing would block the user's auth flow.
    console.error(
      `[auth-email-hook] no template for action "${payload.email_data?.email_action_type ?? 'unknown'}" — nothing sent.`,
    )
    return hookOk()
  }

  // Wrapped so any throw becomes a hookError with a readable cause instead of a bare 500.
  try {
    const admin = createAdminClient()

    const outcome = await sendLogged(admin, {
      template: mapped.template,
      to: mapped.to,
      props: mapped.props,
      userId: mapped.userId,
      dedupeKey: mapped.dedupeKey,
      metadata: { source: 'auth-hook', action: payload.email_data.email_action_type },
    })

    if (outcome.status === 'failed') {
      console.error(`[auth-email-hook] send failed: ${outcome.code} ${outcome.message}`)
      // Fail so the user knows to retry; the code lands in the GoTrue auth log.
      return hookError(`Could not send your email (${outcome.code}). Please try again in a moment.`, 500)
    }

    return hookOk()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[auth-email-hook] unexpected failure: ${detail}`)
    return hookError(`Email hook failed: ${detail}`, 500)
  }
})
