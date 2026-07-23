import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/services/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { AnalyticsEvent, trackEvent } from '@/services/analytics/analytics'

export function LoginPage() {
  const { session, isLoading } = useAuth()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Already signed in → no reason to show the login form.
  if (!isLoading && session) return <Navigate to="/" replace />

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        trackEvent(AnalyticsEvent.UserSignedIn)
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        // Email-confirmation projects return a user with no active session yet.
        if (!data.session) {
          setNotice('Account created. Check your email to confirm your address, then sign in.')
          setIsLogin(true)
        }
        trackEvent(AnalyticsEvent.UserSignedUp)
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
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Career OS</h1>
            <p className="mt-2 text-sm text-muted">
              {isLogin ? 'Sign in to your account' : 'Create a new account'}
            </p>
          </div>

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
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-lg" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                {notice}
              </p>
            )}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Processing…' : isLogin ? 'Sign in' : 'Sign up'}
            </Button>
          </form>

          <div className="text-center mt-6">
            <button
              type="button"
              className="text-sm text-ink-3 hover:text-ink font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
                setNotice(null)
              }}
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
