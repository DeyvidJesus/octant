// Shared CORS helper for Edge Functions.
//
// Locks Access-Control-Allow-Origin to an allowlist instead of "*", so a token exfiltrated via XSS
// can't drive these functions from an arbitrary origin. Configure with either:
//   ALLOWED_ORIGINS="https://app.example.com,https://staging.example.com"
//   (or a single APP_URL, which is reused).
// If neither is set the helper falls back to "*" so local/dev deploys keep working — set the env in
// production. `Vary: Origin` keeps caches correct when the echoed origin varies.
//
// TWO BEHAVIOURS WORTH KNOWING, both learned the hard way:
//
//   1. A request from a NON-allowlisted origin gets no `Access-Control-Allow-Origin` header at all.
//      Echoing back some other allowlisted origin (the previous behaviour) made the browser report a
//      confusing mismatch instead of a plain "origin not allowed", and it silently limited every function
//      to the FIRST entry in the allowlist.
//
//   2. Headers are built PER REQUEST. A module-level constant cannot serve more than one origin, which
//      breaks exactly when it matters most: running two hosts at once during a domain migration.

function allowlist(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_URL') ?? ''
  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/** Base headers shared by every response, with or without an allowed origin. */
const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  Vary: 'Origin',
}

/**
 * CORS headers for one request.
 *
 * Echoes the caller's origin when it is allowlisted. Omits `Access-Control-Allow-Origin` when it is not —
 * the browser then blocks the response, which is the intended outcome, and reports it as an origin that
 * simply isn't permitted.
 *
 * With no allowlist configured at all, falls back to `*` so local development keeps working.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const allowed = allowlist()
  if (allowed.length === 0) return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': '*' }

  const origin = (req.headers.get('Origin') ?? '').replace(/\/+$/, '')
  if (origin !== '' && allowed.includes(origin)) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin }
  }

  // Deliberately no Access-Control-Allow-Origin. Logged because a misconfigured ALLOWED_ORIGINS is
  // otherwise invisible from the client, which only ever sees an opaque "failed to fetch".
  if (origin !== '') {
    console.warn(`[cors] blocked origin "${origin}"; allowed: ${allowed.join(', ')}`)
  }
  return { ...BASE_HEADERS }
}
