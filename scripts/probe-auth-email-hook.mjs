// Sends a signed Send Email Hook request to the deployed auth-email-hook, bypassing GoTrue's email rate limit.
// Usage: yarn email:probe [signup|recovery|magiclink|invite|email_change|reauthentication] [recipient]  (sends real mail)

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Webhook } from 'standardwebhooks'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// loadEnvFile keeps variables already set in the shell, so inline overrides win.
try {
  process.loadEnvFile(path.join(root, '.env'))
} catch {
  // No .env; use the shell environment.
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

// Uses an existing user id so the probe follows the same path as a real signup.
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

// Unique per run: the hook dedupes on token_hash, so a constant value would skip the send and still return 200.
const runId = `probe-${Date.now()}`

// Same shape GoTrue posts; the token is fake, so the email's link verifies nothing.
const payload = JSON.stringify({
  user: {
    // Blank when no user exists; sendLogged maps it to NULL.
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

// GoTrue's contract has hooks report failures as HTTP 200 with an `error` body, so check the body too.
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
