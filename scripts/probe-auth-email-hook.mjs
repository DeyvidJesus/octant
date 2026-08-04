// Sends a correctly-signed Send Email Hook request straight to the deployed `auth-email-hook`.
//
// WHY: GoTrue rate-limits auth emails per project (`over_email_send_rate_limit`, 429). Debugging the hook
// through real signups burns that quota fast — and every failed attempt also leaves a half-created,
// unconfirmed user behind. This talks to the function directly, so you can iterate on the hook without
// touching the rate limit and without creating users.
//
// It signs the payload with the Standard Webhooks scheme, exactly as GoTrue does, so the function's
// signature verification is exercised for real rather than bypassed.
//
// Usage — values come from the local `.env`, so usually just:
//   yarn email:probe [action] [recipient]
//
//   action     signup (default) | recovery | magiclink | invite | email_change | reauthentication
//   recipient  the address the email would go to (default probe@example.com)
//
// Any variable already set in the shell wins over `.env`, so a one-off override works:
//   SEND_EMAIL_HOOK_SECRET='v1,whsec_...' yarn email:probe signup you@example.com
//
// A real email IS sent if the function is fully configured — use an address you own.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Webhook } from 'standardwebhooks'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Node does not read `.env` on its own, and the secrets this needs already live there. `loadEnvFile`
// leaves variables that are already set alone, so an inline override still takes precedence.
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // No local `.env` (or a Node without loadEnvFile) — fall back to whatever the shell provides.
}

const action = process.argv[2] ?? 'signup'
const recipient = process.argv[3] ?? 'probe@example.com'

const rawSecret = process.env.SEND_EMAIL_HOOK_SECRET
const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')

if (!rawSecret) {
  console.error(
    'SEND_EMAIL_HOOK_SECRET is not set.\n' +
      '  Add it to .env, or pass it inline. Get the value from:\n' +
      '  Supabase Dashboard › Authentication › Hooks › Send Email (looks like `v1,whsec_...`).',
  )
  process.exit(1)
}
if (!supabaseUrl) {
  console.error('SUPABASE_URL (or VITE_SUPABASE_URL) is not set — add it to .env.')
  process.exit(1)
}

/**
 * Finds a REAL user id.
 *
 * `email_log.user_id` has a foreign key to `auth.users`, so a made-up uuid makes the hook's claim insert
 * fail with 23503 — which looks exactly like a broken hook while actually being a broken probe. Using a
 * real id exercises the same path a genuine signup takes.
 */
async function findRealUserId() {
  const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey === undefined) return undefined
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    })
    if (!response.ok) return undefined
    const body = await response.json()
    return body?.users?.[0]?.id
  } catch {
    return undefined
  }
}

const userId = await findRealUserId()
if (userId === undefined) {
  console.warn(
    'No existing user found (or no service key in .env), so the probe sends no user id.\n' +
      'The email_log row will be recorded with user_id = NULL. Rendering and delivery are still\n' +
      'exercised in full — only the user association is skipped.\n',
  )
}

/**
 * Unique per run, and that matters: the hook keys de-duplication on `token_hash`, so a constant value
 * made every probe after the first return 200 via dedup WITHOUT sending anything — a false "it works"
 * that hides a real breakage. A fresh hash makes each run a genuine send.
 */
const runId = `probe-${Date.now()}`

/**
 * Mirrors the shape GoTrue posts. `token_hash` is fake — the email will render and send, but its link
 * will not verify anything, which is exactly what you want for a probe.
 */
const payload = JSON.stringify({
  user: {
    // Empty when no real user exists. A made-up uuid would trip the foreign key on `email_log.user_id`
    // and look like a broken hook; `sendLogged` maps blank to NULL instead.
    id: userId ?? '',
    email: recipient,
    new_email: action.startsWith('email_change') ? `new+${recipient}` : null,
    user_metadata: { name: 'Probe User' },
  },
  email_data: {
    token: '123456',
    token_hash: `${runId}-hash`,
    token_new: '',
    token_hash_new: `${runId}-hash-new`,
    redirect_to: `${supabaseUrl.replace('.supabase.co', '')}/auth/callback`,
    email_action_type: action,
    site_url: supabaseUrl,
  },
})

// Supabase issues the secret as `v1,whsec_<base64>`; the library strips `whsec_` itself.
const webhook = new Webhook(rawSecret.replace(/^v1,/, ''))
const messageId = runId
const timestamp = new Date()
const signature = webhook.sign(messageId, timestamp, payload)

const endpoint = `${supabaseUrl}/functions/v1/auth-email-hook`
console.log(`POST ${endpoint}`)
console.log(`  action=${action}  recipient=${recipient}\n`)

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'webhook-id': messageId,
    'webhook-timestamp': Math.floor(timestamp.getTime() / 1000).toString(),
    'webhook-signature': signature,
  },
  body: payload,
})

const text = await response.text()
console.log(`HTTP ${response.status}`)
console.log(text || '(empty body)')

/**
 * The status code alone is NOT the verdict.
 *
 * A hook reports a business failure as HTTP 200 with an `{ error: … }` body — that is the contract GoTrue
 * requires (a non-200 makes it discard the body and report "Unexpected status code"). So checking only the
 * status would call a failed send a success, which is precisely the false positive this probe exists to
 * eliminate.
 */
let hookErrorMessage
try {
  hookErrorMessage = JSON.parse(text)?.error?.message
} catch {
  hookErrorMessage = response.ok ? undefined : text
}

if (response.ok && hookErrorMessage === undefined) {
  console.log('\n✓ Hook accepted the request. Verify it actually sent:')
  console.log('   a row for this run should be in `email_log` with status sent/delivered.')
  process.exit(0)
}

console.log(`\n✗ Hook reported a failure: ${hookErrorMessage ?? `HTTP ${response.status}`}`)
process.exit(1)
