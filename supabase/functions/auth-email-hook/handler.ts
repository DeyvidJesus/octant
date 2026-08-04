// Supabase Edge Function: auth-email-hook
//
// Phase 15 — Supabase Auth's "Send Email Hook". GoTrue calls this INSTEAD of sending its own email, so
// enabling the hook replaces every default auth template at once. One endpoint covers six of the
// fourteen templates: verify-email, password-reset, magic-link, invitation, email-changed (both halves)
// and the reauthentication security alert.
//
// The payload → template mapping lives in `@octant/email` (`integrations/supabaseAuth.ts`) because it is
// pure and therefore unit-tested; this file holds only what needs a runtime: signature verification,
// HTTP, and the delivery log.
//
// Source of truth: edit `handler.ts`, then run `yarn build:functions` to regenerate `index.ts`.
//
// Deploy:  yarn build:functions && supabase functions deploy auth-email-hook --no-verify-jwt
//          (GoTrue sends a Standard Webhooks signature, NOT a Supabase JWT — verification MUST be off.)
// Secrets: supabase secrets set SEND_EMAIL_HOOK_SECRET=v1,whsec_... RESEND_API_KEY=re_... \
//          EMAIL_FROM="Octant <noreply@useoctant.com>" APP_URL=https://app...
//          (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
// Then enable the hook: Dashboard › Authentication › Hooks › Send Email.

import { createClient } from 'jsr:@supabase/supabase-js@2'
// Bare specifier on purpose: the bundler rewrites it to a pinned `npm:` URL using the version declared
// in the root package.json, so there is no second place for that version to drift.
import { Webhook } from 'standardwebhooks'
import { formatDateTime, mapAuthEmail, type AuthHookPayload } from '@octant/email'
import { sendLogged } from '../_shared/mailer.ts'

/**
 * GoTrue's expected error envelope. Returning it surfaces `message` to the end user and aborts the auth
 * operation, which is the right outcome for a send failure: a user who silently never receives a
 * verification link has no way to tell that anything went wrong.
 */
function hookError(message: string, httpCode: number): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { 'content-type': 'application/json' },
  })
}

/** Success is an empty JSON object with 200 — GoTrue then skips its own send. */
function hookOk(): Response {
  return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return hookError('Method not allowed.', 405)

  const rawSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (rawSecret === undefined || rawSecret === '') {
    console.error('[auth-email-hook] SEND_EMAIL_HOOK_SECRET is not set — refusing to process the hook.')
    return hookError('Email hook is not configured.', 500)
  }

  const body = await req.text()

  // Verify the Standard Webhooks signature before parsing anything. Supabase issues the secret as
  // `v1,whsec_<base64>`; the library strips `whsec_` itself, so only the `v1,` prefix needs removing.
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
    return hookError('Invalid hook signature.', 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/+$/, '')
  if (supabaseUrl === '') return hookError('Server is missing SUPABASE_URL.', 500)

  const mapped = mapAuthEmail(payload, {
    supabaseUrl,
    // Where the verification link lands once GoTrue has established the session.
    defaultRedirectTo: `${appUrl}/auth/callback`,
    // Formatted here rather than inside the pure mapper, which must stay clock-free to be testable.
    occurredAt: formatDateTime(new Date().toISOString()),
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  })

  if (mapped === null) {
    // An action we don't render (a future GoTrue addition, or a payload with no usable token). Ack with
    // 200 rather than 500: a hard failure here would block the user's auth flow entirely, whereas this
    // leaves a loud signal in the logs while the flow keeps working.
    console.error(
      `[auth-email-hook] no template for action "${payload.email_data?.email_action_type ?? 'unknown'}" — nothing sent.`,
    )
    return hookOk()
  }

  const admin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  const outcome = await sendLogged(admin, {
    template: mapped.template,
    to: mapped.to,
    props: mapped.props,
    userId: mapped.userId,
    dedupeKey: mapped.dedupeKey,
    metadata: { source: 'auth-hook', action: payload.email_data.email_action_type },
  })

  if (outcome.status === 'failed') {
    // Fail loudly: the user is mid-signup/mid-reset and needs to know to try again.
    return hookError('We could not send your email. Please try again in a moment.', 500)
  }

  return hookOk()
})
