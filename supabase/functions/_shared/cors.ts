// CORS headers built per request from ALLOWED_ORIGINS (or APP_URL). Falls back to "*" when neither is set,
// so set one in production.

function allowlist(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS') ?? Deno.env.get('APP_URL') ?? ''
  return raw
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

const BASE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  Vary: 'Origin',
}

/** Echoes the origin when allowlisted; otherwise omits Access-Control-Allow-Origin so the browser blocks it. */
export function corsHeaders(req: Request): Record<string, string> {
  const allowed = allowlist()
  if (allowed.length === 0) return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': '*' }

  const origin = (req.headers.get('Origin') ?? '').replace(/\/+$/, '')
  if (origin !== '' && allowed.includes(origin)) {
    return { ...BASE_HEADERS, 'Access-Control-Allow-Origin': origin }
  }

  // Logged because the client only sees an opaque "failed to fetch".
  if (origin !== '') {
    console.warn(`[cors] blocked origin "${origin}"; allowed: ${allowed.join(', ')}`)
  }
  return { ...BASE_HEADERS }
}
