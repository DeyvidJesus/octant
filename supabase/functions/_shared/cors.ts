// Shared CORS helper for Edge Functions.
//
// Locks Access-Control-Allow-Origin to an allowlist instead of "*", so a token exfiltrated via XSS
// can't drive these functions from an arbitrary origin. Configure with either:
//   ALLOWED_ORIGINS="https://app.example.com,https://staging.example.com"
//   (or a single APP_URL, which is reused).
// If neither is set the helper falls back to "*" so local/dev deploys keep working — set the env in
// production. `Vary: Origin` keeps caches correct when the echoed origin varies.

function allowlist(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_URL') ?? ''
  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

export function corsHeaders(req: Request): Record<string, string> {
  const allowed = allowlist()
  const origin = (req.headers.get('Origin') ?? '').replace(/\/+$/, '')
  const allowOrigin = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    Vary: 'Origin',
  }
}

/**
 * Origin-independent variant for functions that keep a module-level headers object. Uses the first
 * allowlisted origin (or "*" if none configured) — fine for same-origin callers like the app's
 * billing flows.
 */
export function staticCorsHeaders(): Record<string, string> {
  const allowed = allowlist()
  return {
    'Access-Control-Allow-Origin': allowed[0] ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    Vary: 'Origin',
  }
}
