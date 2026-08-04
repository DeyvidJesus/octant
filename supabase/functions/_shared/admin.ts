// Service-role Supabase client for Edge Functions.
//
// WHY THIS EXISTS: `createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')` is a trap. On a
// project using Supabase's NEW API key system (`sb_publishable_…` / `sb_secret_…`) the legacy
// `SUPABASE_SERVICE_ROLE_KEY` may not be present in the function environment at all — and passing `''`
// makes `createClient` THROW "supabaseKey is required". Uncaught, that surfaces as a bare 500 with no
// hint of the cause, which is exactly how a broken auth hook looks from the outside.
//
// So: resolve the credential from every name it can legitimately have, and fail with a message that says
// what to set.

import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Environment variables that can hold a key able to bypass RLS, newest naming first.
 *
 *   SUPABASE_SECRET_KEY        — new API key system (`sb_secret_…`)
 *   SUPABASE_SERVICE_ROLE_KEY  — legacy JWT, auto-injected on older projects
 */
const SERVICE_KEY_VARS = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const

/** The first service-role credential present in the environment, or `undefined`. */
export function serviceRoleKey(): string | undefined {
  for (const name of SERVICE_KEY_VARS) {
    const value = Deno.env.get(name)
    if (value !== undefined && value.trim() !== '') return value.trim()
  }
  return undefined
}

/** Raised instead of the SDK's opaque "supabaseKey is required", so the log names the fix. */
export class MissingServiceKeyError extends Error {
  constructor() {
    super(
      `No service-role credential found. Set one of ${SERVICE_KEY_VARS.join(' / ')} ` +
        '(`supabase secrets set SUPABASE_SECRET_KEY=sb_secret_...`).',
    )
    this.name = 'MissingServiceKeyError'
  }
}

/**
 * Admin client that bypasses RLS. Throws `MissingServiceKeyError` when unconfigured — callers are
 * expected to catch it and return a specific error, never to let it escape as a generic 500.
 */
// deno-lint-ignore no-explicit-any
export function createAdminClient(): any {
  const url = requireUrl()
  const key = serviceRoleKey()
  if (key === undefined) throw new MissingServiceKeyError()

  return createClient(url, key, { auth: { persistSession: false } })
}

/**
 * Public/anon key names, newest first. Same hazard as the service key: on a new-API-key project the
 * legacy `SUPABASE_ANON_KEY` may be absent, and an empty string makes `createClient` throw.
 */
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

/**
 * Client scoped to the CALLER's JWT, for verifying who is making a request. Uses the public key plus the
 * caller's `Authorization` header, so RLS still applies — never the service key, which would make every
 * request look like an admin.
 */
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
