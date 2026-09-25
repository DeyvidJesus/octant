/**
 * "Forgot password" — requests the reset email.
 *
 * The success message is intentionally identical whether or not the address has an account. Confirming
 * "no such user" would turn this form into an account-enumeration oracle, which is exactly how attackers
 * build target lists. Supabase's API is silent about it too, so the UI must not be more helpful.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '@/constants/brand'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'
import { requestPasswordReset } from '@/services/supabase/auth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      trackEvent(AnalyticsEvent.PasswordResetRequested)
      setSent(true)
    } catch (err) {
      // Only genuine transport/config failures reach here — a missing account is not an error.
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base py-12 px-4">
      <div className="max-w-md w-full">
        <Card className="p-8 bg-surface border-edge-2">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-ink">{APP_NAME}</h1>
            <p className="mt-2 text-sm text-muted">Reset your password</p>
          </div>

          {sent ? (
            <div className="space-y-5">
              <p className="text-sm text-success bg-success-strong/10 border border-success-strong/20 p-3 rounded-lg">
                If an account exists for {email}, a reset link is on its way. It expires in an hour.
              </p>
              <p className="text-sm text-muted">
                Nothing in your inbox after a few minutes? Check spam, then try again.
              </p>
              <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
                Use a different address
              </Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <Field label="Email address" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>

              {error && (
                <p
                  className="text-sm text-danger bg-danger-strong/10 border border-danger-strong/20 p-3 rounded-lg"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <Button type="submit" variant="primary" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          )}

          <div className="text-center mt-6">
            <Link
              to="/login"
              className="text-sm text-ink-3 hover:text-ink font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong rounded"
            >
              Back to sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
