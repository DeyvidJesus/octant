// Supabase clients for Edge Functions. Keys are resolved from both the new and legacy env names, because
// passing '' to createClient throws an opaque "supabaseKey is required".

import { createClient } from 'jsr:@supabase/supabase-js@2'

/** RLS-bypassing key names, newest first: `sb_secret_…`, then the legacy service-role JWT. */
const SERVICE_KEY_VARS = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const

/** The first service-role credential present in the environment, or `undefined`. */
export function serviceRoleKey(): string | undefined {
  for (const name of SERVICE_KEY_VARS) {
    const value = Deno.env.get(name)
    if (value !== undefined && value.trim() !== '') return value.trim()
  }
  return undefined
}

/** Replaces the SDK's opaque "supabaseKey is required" with a message that names the fix. */
export class MissingServiceKeyError extends Error {
  constructor() {
    super(
      `No service-role credential found. Set one of ${SERVICE_KEY_VARS.join(' / ')} ` +
        '(`supabase secrets set SUPABASE_SECRET_KEY=sb_secret_...`).',
    )
    this.name = 'MissingServiceKeyError'
  }
}

/** Admin client that bypasses RLS. Throws `MissingServiceKeyError`; callers should catch it, not 500. */
// deno-lint-ignore no-explicit-any
export function createAdminClient(): any {
  const url = requireUrl()
  const key = serviceRoleKey()
  if (key === undefined) throw new MissingServiceKeyError()

  return createClient(url, key, { auth: { persistSession: false } })
}

/** Public key names, newest first. The legacy SUPABASE_ANON_KEY may be absent on new-key projects. */
const PUBLIC_KEY_VARS = ['SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY'] as const

function publicKey(): string | undefined {
  for (const name of PUBLIC_KEY_VARS) {
    const value = Deno.env.get(name)
    if (value !== undefined && value.trim() !== '') return value.trim()
  }
  return undefined
}

function requireUrl(): string {
  const url = Deno.env.get('SUPABASE_URL')
  if (url === undefined || url === '') throw new Error('SUPABASE_URL is not set.')
  return url
}

/** Client scoped to the caller's JWT (public key + their Authorization header), so RLS still applies. */
// deno-lint-ignore no-explicit-any
export function createUserClient(authHeader: string): any {
  const url = requireUrl()
  const key = publicKey()
  if (key === undefined) {
    throw new Error(
      `No public API key found. Set one of ${PUBLIC_KEY_VARS.join(' / ')} if the runtime does not inject it.`,
    )
  }

  return createClient(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}
