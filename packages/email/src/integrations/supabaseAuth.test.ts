import { describe, expect, it } from 'vitest'
import {
  AuthEmailAction,
  buildVerificationUrl,
  displayNameFrom,
  mapAuthEmail,
  type AuthEmailContext,
  type AuthHookPayload,
} from './supabaseAuth.ts'
import { SecurityAlertKind } from '../templates/props.ts'
import { propsOf } from './testHelpers.ts'

const CONTEXT: AuthEmailContext = {
  supabaseUrl: 'https://abcdefgh.supabase.co',
  defaultRedirectTo: 'https://app.useoctant.com/auth/callback',
  occurredAt: '4 Aug 2026, 14:32 UTC',
  ipAddress: '203.0.113.42',
  userAgent: 'Chrome on macOS',
}

function payload(overrides: Partial<AuthHookPayload['email_data']>, user?: Partial<AuthHookPayload['user']>): AuthHookPayload {
  return {
    user: { id: 'user-1', email: 'ana@example.com', user_metadata: { name: 'Ana' }, ...user },
    email_data: { token: '123456', token_hash: 'hash-abc', ...overrides },
  }
}

describe('displayNameFrom', () => {
  it('reads the common metadata keys in order', () => {
    expect(displayNameFrom({ name: 'Ana' })).toBe('Ana')
    expect(displayNameFrom({ full_name: 'Ana Souza' })).toBe('Ana Souza')
    expect(displayNameFrom({ first_name: 'Ana' })).toBe('Ana')
  })

  it('ignores blank and non-string values', () => {
    expect(displayNameFrom({ name: '   ' })).toBeUndefined()
    expect(displayNameFrom({ name: 42 })).toBeUndefined()
    expect(displayNameFrom(null)).toBeUndefined()
    expect(displayNameFrom(undefined)).toBeUndefined()
  })
})

describe('buildVerificationUrl', () => {
  it('points at GoTrue\'s verify endpoint, not the app', () => {
    const url = buildVerificationUrl({
      supabaseUrl: 'https://abcdefgh.supabase.co',
      tokenHash: 'hash-abc',
      actionType: 'signup',
      redirectTo: 'https://app.useoctant.com/auth/callback',
    })
    expect(url.startsWith('https://abcdefgh.supabase.co/auth/v1/verify?')).toBe(true)
  })

  it('url-encodes the redirect so query params survive', () => {
    const url = buildVerificationUrl({
      supabaseUrl: 'https://abcdefgh.supabase.co/',
      tokenHash: 'hash+abc/xyz=',
      actionType: 'recovery',
      redirectTo: 'https://app.useoctant.com/reset-password?next=/settings',
    })
    expect(url).toContain('token=hash%2Babc%2Fxyz%3D')
    expect(url).toContain('redirect_to=https%3A%2F%2Fapp.useoctant.com%2Freset-password%3Fnext%3D%2Fsettings')
    // No double slash from the trailing slash on the base URL.
    expect(url).not.toContain('.co//auth')
  })
})

describe('mapAuthEmail', () => {
  it('maps signup to verify-email', () => {
    const result = mapAuthEmail(payload({ email_action_type: AuthEmailAction.Signup }), CONTEXT)
    expect(result).toMatchObject({ template: 'verify-email', to: 'ana@example.com', userId: 'user-1' })
    expect(result?.props).toMatchObject({ name: 'Ana', token: '123456' })
    expect(propsOf<{ verifyUrl: string }>(result).verifyUrl).toContain('type=signup')
  })

  it('maps recovery to password-reset and carries the request metadata', () => {
    const result = mapAuthEmail(payload({ email_action_type: AuthEmailAction.Recovery }), CONTEXT)
    expect(result?.template).toBe('password-reset')
    expect(result?.props).toMatchObject({
      occurredAt: '4 Aug 2026, 14:32 UTC',
      ipAddress: '203.0.113.42',
      userAgent: 'Chrome on macOS',
    })
  })

  it('maps magiclink to magic-link', () => {
    const result = mapAuthEmail(payload({ email_action_type: AuthEmailAction.MagicLink }), CONTEXT)
    expect(result?.template).toBe('magic-link')
    expect(propsOf<{ magicLinkUrl: string }>(result).magicLinkUrl).toContain('type=magiclink')
  })

  it('maps invite to invitation', () => {
    const result = mapAuthEmail(payload({ email_action_type: AuthEmailAction.Invite }), CONTEXT)
    expect(result?.template).toBe('invitation')
    expect(result?.props).toMatchObject({ expiresInDays: 7 })
  })

  it('gives the NEW address a working confirmation link', () => {
    const result = mapAuthEmail(
      payload({ email_action_type: AuthEmailAction.EmailChangeNew, token_hash_new: 'hash-new' }, { new_email: 'ana.souza@example.com' }),
      CONTEXT,
    )
    expect(result).toMatchObject({ template: 'email-changed', to: 'ana.souza@example.com' })
    const props = propsOf<{ confirmUrl?: string; oldEmail?: string }>(result)
    expect(props.confirmUrl).toContain('hash-new')
    expect(props.oldEmail).toBe('ana@example.com')
  })

  it('gives the OLD address a notice with NO link — it is the takeover tripwire', () => {
    const result = mapAuthEmail(
      payload({ email_action_type: AuthEmailAction.EmailChangeCurrent }, { new_email: 'ana.souza@example.com' }),
      CONTEXT,
    )
    expect(result).toMatchObject({ template: 'email-changed', to: 'ana@example.com' })
    const props = propsOf<{ confirmUrl?: string; newEmail: string }>(result)
    expect(props.confirmUrl).toBeUndefined()
    expect(props.newEmail).toBe('ana.souza@example.com')
  })

  it('maps reauthentication to a security alert carrying the code', () => {
    const result = mapAuthEmail(payload({ email_action_type: AuthEmailAction.Reauthentication }), CONTEXT)
    expect(result?.template).toBe('security-alert')
    expect(result?.props).toMatchObject({ kind: SecurityAlertKind.Reauthentication, code: '123456' })
  })

  it('keys de-duplication on the token hash so a second genuine request still sends', () => {
    const first = mapAuthEmail(payload({ email_action_type: AuthEmailAction.Recovery, token_hash: 'h1' }), CONTEXT)
    const second = mapAuthEmail(payload({ email_action_type: AuthEmailAction.Recovery, token_hash: 'h2' }), CONTEXT)
    expect(first?.dedupeKey).not.toBe(second?.dedupeKey)
  })

  it('falls back to the default redirect when the hook supplies none', () => {
    const result = mapAuthEmail(payload({ email_action_type: AuthEmailAction.Signup }), CONTEXT)
    expect(propsOf<{ verifyUrl: string }>(result).verifyUrl).toContain(
      encodeURIComponent('https://app.useoctant.com/auth/callback'),
    )
  })

  it('passes a supplied redirect through rather than overriding it', () => {
    const result = mapAuthEmail(
      payload({ email_action_type: AuthEmailAction.Signup, redirect_to: 'https://app.useoctant.com/welcome' }),
      CONTEXT,
    )
    expect(propsOf<{ verifyUrl: string }>(result).verifyUrl).toContain(
      encodeURIComponent('https://app.useoctant.com/welcome'),
    )
  })

  it('returns null rather than throwing for unusable payloads', () => {
    expect(mapAuthEmail(payload({ email_action_type: undefined }), CONTEXT)).toBeNull()
    expect(mapAuthEmail(payload({ email_action_type: '' }), CONTEXT)).toBeNull()
    // No token hash → the link would be dead.
    expect(
      mapAuthEmail({ user: { id: 'u', email: 'a@b.co' }, email_data: { email_action_type: 'signup' } }, CONTEXT),
    ).toBeNull()
    // No recipient.
    expect(mapAuthEmail(payload({ email_action_type: 'signup' }, { email: null }), CONTEXT)).toBeNull()
    // Unknown future action type must not break the user's auth flow.
    expect(mapAuthEmail(payload({ email_action_type: 'some_future_action' }), CONTEXT)).toBeNull()
  })

  it('omits the name when metadata has none, so the greeting degrades gracefully', () => {
    const result = mapAuthEmail(payload({ email_action_type: 'signup' }, { user_metadata: {} }), CONTEXT)
    expect(propsOf<{ name?: string }>(result).name).toBeUndefined()
  })
})
