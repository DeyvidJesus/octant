/**
 * Where every email link lands.
 *
 * GoTrue's `/auth/v1/verify` endpoint validates the token hash, establishes the session, and then
 * redirects here. Before this route existed there was nowhere for a verification or magic link to go —
 * the only public route was `/login`, so a confirmed user was bounced to a sign-in form with no
 * explanation.
 *
 * Two cases have to be distinguished, because Supabase reuses the same redirect for both:
 *   * `type=recovery` → the session exists ONLY so the user can set a new password. Send them to
 *     `/reset-password`, not into the app; dropping them on the dashboard leaves the reset unfinished.
 *   * everything else → a normal session. Go to the app.
 *
 * An error arrives as query or hash params (`error`, `error_description`) — most often an expired link,
 * which needs an actionable message rather than a spinner that never resolves.
 */

import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { APP_NAME } from '@/constants/brand'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/** Supabase puts implicit-flow results in the URL fragment, which `useSearchParams` cannot see. */
function readHashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ''))
}

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { session, isLoading } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const hashParams = readHashParams()
    const description = searchParams.get('error_description') ?? hashParams.get('error_description')
    const code = searchParams.get('error') ?? hashParams.get('error')
    if (description !== null || code !== null) {
      setError(description ?? code ?? 'This link is no longer valid.')
      return
    }

    // A recovery session must finish at the password form, not in the app.
    const type = searchParams.get('type') ?? hashParams.get('type')
    if (type === 'recovery') navigate('/reset-password', { replace: true })
  }, [searchParams, navigate])

  if (error !== null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base py-12 px-4">
        <div className="max-w-md w-full">
          <Card className="p-8 bg-surface border-edge-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink mb-3">This link didn't work</h1>
            <p className="text-sm text-ink-3 mb-6">{error}</p>
            <p className="text-sm text-muted mb-6">
              Email links expire for security. Request a fresh one and it'll arrive in a moment.
            </p>
            <Button variant="primary" className="w-full" onClick={() => navigate('/login', { replace: true })}>
              Back to sign in
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  // Session established → into the app. AuthContext also fires the welcome email at this point.
  if (!isLoading && session) return <Navigate to="/" replace />
  if (!isLoading && !session) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen flex items-center justify-center bg-base" role="status" aria-live="polite">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4" />
        <p className="text-sm text-muted">Signing you in to {APP_NAME}…</p>
      </div>
    </div>
  )
}
