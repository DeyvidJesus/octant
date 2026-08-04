// @vitest-environment happy-dom
// (needed for `window.location.origin`, which the redirect URLs are built from)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * These tests exist because of a real bug: `sendMagicLink` sets `shouldCreateUser: false`, which makes
 * GoTrue reject unknown addresses with `otp_disabled` ("Signups not allowed for otp"). Surfacing that
 * rejection turned the sign-in form into an account-enumeration oracle — the success message was written
 * to reveal nothing, and the error path revealed everything.
 *
 * The non-enumeration property has to hold in the SERVICE, not the UI, so a future caller cannot
 * reintroduce the leak by forgetting to special-case it. That is what these assertions pin down.
 */

const signInWithOtp = vi.fn()
const resend = vi.fn()
const resetPasswordForEmail = vi.fn()
const signInWithPassword = vi.fn()

vi.mock('./client', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      resend: (...args: unknown[]) => resend(...args),
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmail(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
    },
  },
}))

const { requestPasswordReset, resendVerification, sendMagicLink, signIn } = await import('./auth')

/** Shape of a GoTrue failure as `@supabase/auth-js` surfaces it. */
function authError(code: string, message: string) {
  return { error: { code, message, status: 422 } }
}

beforeEach(() => {
  signInWithOtp.mockResolvedValue({ error: null })
  resend.mockResolvedValue({ error: null })
  resetPasswordForEmail.mockResolvedValue({ error: null })
  signInWithPassword.mockResolvedValue({ error: null })
})

afterEach(() => vi.clearAllMocks())

describe('sendMagicLink', () => {
  it('never creates an account — it is a sign-in, not a back-door signup', async () => {
    await sendMagicLink('ana@example.com')
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    )
  })

  it('points the link at the app callback route', async () => {
    await sendMagicLink('ana@example.com')
    const { options } = signInWithOtp.mock.calls[0][0]
    expect(options.emailRedirectTo).toMatch(/\/auth\/callback$/)
  })

  it('resolves silently for an unknown address (otp_disabled)', async () => {
    signInWithOtp.mockResolvedValue(authError('otp_disabled', 'Signups not allowed for otp'))
    await expect(sendMagicLink('nobody@example.com')).resolves.toBeUndefined()
  })

  it('resolves silently for user_not_found', async () => {
    signInWithOtp.mockResolvedValue(authError('user_not_found', 'User not found'))
    await expect(sendMagicLink('nobody@example.com')).resolves.toBeUndefined()
  })

  it('resolves silently when an older GoTrue sends only the message', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } })
    await expect(sendMagicLink('nobody@example.com')).resolves.toBeUndefined()
  })

  it('STILL throws for real failures — a rate limit must not look like success', async () => {
    signInWithOtp.mockResolvedValue(authError('over_email_send_rate_limit', 'Email rate limit exceeded'))
    await expect(sendMagicLink('ana@example.com')).rejects.toMatchObject({
      code: 'over_email_send_rate_limit',
    })
  })

  it('STILL throws when the email provider is disabled — that is misconfiguration, not enumeration', async () => {
    signInWithOtp.mockResolvedValue(authError('email_provider_disabled', 'Email logins are disabled'))
    await expect(sendMagicLink('ana@example.com')).rejects.toMatchObject({
      code: 'email_provider_disabled',
    })
  })
})

describe('resendVerification', () => {
  it('resolves silently for an unknown address', async () => {
    resend.mockResolvedValue(authError('user_not_found', 'User not found'))
    await expect(resendVerification('nobody@example.com')).resolves.toBeUndefined()
  })

  it('still throws for a rate limit', async () => {
    resend.mockResolvedValue(authError('over_email_send_rate_limit', 'Email rate limit exceeded'))
    await expect(resendVerification('ana@example.com')).rejects.toMatchObject({
      code: 'over_email_send_rate_limit',
    })
  })
})

describe('requestPasswordReset', () => {
  it('lands on the dedicated reset route, not the app root', async () => {
    await requestPasswordReset('ana@example.com')
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      'ana@example.com',
      expect.objectContaining({ redirectTo: expect.stringMatching(/\/reset-password$/) }),
    )
  })
})

describe('signIn', () => {
  it('propagates bad credentials — this path must never be silenced', async () => {
    signInWithPassword.mockResolvedValue(authError('invalid_credentials', 'Invalid login credentials'))
    await expect(signIn('ana@example.com', 'wrong')).rejects.toMatchObject({
      code: 'invalid_credentials',
    })
  })
})
