/**
 * Where a recovery link finishes: set a new password.
 *
 * The recovery link has already established a session by the time this renders (GoTrue does it during the
 * redirect), so `updateUser({ password })` is all that's needed — there is no token to handle here.
 *
 * Ordering matters on submit: the "your password changed" notice is sent only AFTER the update succeeds.
 * Sending it first would tell a user their password changed when it hadn't, which for a security email is
 * worse than sending nothing.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP_NAME } from '@/constants/brand'
import { useAuth } from '@/contexts/AuthContext'
import { sendPasswordChangedEmail } from '@/services/email/notifications'
import { updatePassword } from '@/services/supabase/auth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'

/** Supabase enforces a minimum server-side; mirroring it here avoids a pointless round-trip. */
const MIN_PASSWORD_LENGTH = 8

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { session, isLoading } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirmation) {
      setError("Those passwords don't match.")
      return
    }

    setLoading(true)
    try {
      await updatePassword(password)
      // Only now — the notice must describe something that actually happened. Fire-and-forget so a
      // mail hiccup can't strand the user on a form whose submission already succeeded.
      void sendPasswordChangedEmail()
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // No session means the link was never opened (or has expired) — there is nothing to reset here.
  if (!isLoading && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base py-12 px-4">
        <div className="max-w-md w-full">
          <Card className="p-8 bg-surface border-edge-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink mb-3">This reset link has expired</h1>
            <p className="text-sm text-ink-3 mb-6">
              Reset links are single-use and expire after an hour. Request a new one to continue.
            </p>
            <Button variant="primary" className="w-full" onClick={() => navigate('/forgot-password')}>
              Request a new link
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base py-12 px-4">
      <div className="max-w-md w-full">
        <Card className="p-8 bg-surface border-edge-2">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{APP_NAME}</h1>
            <p className="mt-2 text-sm text-muted">Choose a new password</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <Field label="New password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmation">
              <Input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <p
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button type="submit" variant="primary" className="w-full" disabled={loading || isLoading}>
              {loading ? 'Saving…' : 'Update password'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
