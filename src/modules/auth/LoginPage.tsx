import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { APP_NAME } from '@/constants/brand'
import { useAuth } from '@/contexts/useAuth'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'
import { sendMagicLink, signIn, signUp } from '@/services/supabase/auth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'

// Auth calls go through `services/supabase/auth.ts`, which owns the redirect URLs for email links.
type Mode = 'signin' | 'signup' | 'magic'

const MODE_COPY: Record<Mode, { subtitle: string; submit: string; pending: string }> = {
  signin: { subtitle: 'Sign in to your account', submit: 'Sign in', pending: 'Signing in…' },
  signup: { subtitle: 'Create a new account', submit: 'Sign up', pending: 'Creating account…' },
  magic: { subtitle: 'Sign in without a password', submit: 'Email me a link', pending: 'Sending…' },
}

export function LoginPage() {
  const { session, isLoading } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!isLoading && session) return <Navigate to="/" replace />

  const copy = MODE_COPY[mode]

  const switchTo = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else if (mode === 'signup') {
        const { hasSession } = await signUp(email, password, name)
        // Email-confirmation projects return a user with no active session yet.
        if (!hasSession) {
          setNotice('Account created. Check your email to confirm your address, then sign in.')
          setMode('signin')
        }
      } else {
        await sendMagicLink(email)
        trackEvent(AnalyticsEvent.MagicLinkRequested)
        setNotice(`If an account exists for ${email}, a sign-in link is on its way.`)
      }
    } catch (err) {
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
            <p className="mt-2 text-sm text-muted">{copy.subtitle}</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <Field label="Your name" htmlFor="name">
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ana Souza"
                />
              </Field>
            )}

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

            {mode !== 'magic' && (
              <Field label="Password" htmlFor="password">
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
            )}

            {error && (
              <p
                className="text-sm text-danger bg-danger-strong/10 border border-danger-strong/20 p-3 rounded-lg"
                role="alert"
              >
                {error}
              </p>
            )}
            {notice && (
              <p className="text-sm text-success bg-success-strong/10 border border-success-strong/20 p-3 rounded-lg">
                {notice}
              </p>
            )}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? copy.pending : copy.submit}
            </Button>
          </form>

          <div className="mt-6 space-y-3 text-center">
            <button
              type="button"
              className="block w-full text-sm text-ink-3 hover:text-ink font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong rounded"
              onClick={() => switchTo(mode === 'signup' ? 'signin' : 'signup')}
            >
              {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>

            <button
              type="button"
              className="block w-full text-sm text-muted hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong rounded"
              onClick={() => switchTo(mode === 'magic' ? 'signin' : 'magic')}
            >
              {mode === 'magic' ? 'Use a password instead' : 'Email me a sign-in link instead'}
            </button>

            {mode === 'signin' && (
              <Link
                to="/forgot-password"
                className="block text-sm text-muted hover:text-ink transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong rounded"
              >
                Forgot your password?
              </Link>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
