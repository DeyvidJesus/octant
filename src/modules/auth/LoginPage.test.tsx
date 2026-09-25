// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'

// Each mode must call its own auth service, since the services set the redirect URLs email links need.

const signIn = vi.fn()
const signUp = vi.fn()
const sendMagicLink = vi.fn()

vi.mock('@/services/supabase/auth', () => ({
  signIn: (...args: unknown[]) => signIn(...args),
  signUp: (...args: unknown[]) => signUp(...args),
  sendMagicLink: (...args: unknown[]) => sendMagicLink(...args),
}))

vi.mock('@/contexts/useAuth', () => ({
  useAuth: () => ({ session: null, user: null, isLoading: false }),
}))

vi.mock('@/services/analytics/analytics', () => ({
  AnalyticsEvent: { MagicLinkRequested: 'magic_link_requested' },
  trackEvent: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

function fillEmail(value = 'ana@example.com') {
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value } })
}

beforeEach(() => {
  signIn.mockResolvedValue(undefined)
  signUp.mockResolvedValue({ hasSession: false })
  sendMagicLink.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('signs in with email and password by default', async () => {
    renderPage()
    fillEmail()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2222' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(signIn).toHaveBeenCalledWith('ana@example.com', 'hunter2222'))
    expect(signUp).not.toHaveBeenCalled()
  })

  it('offers a password-reset link only in sign-in mode', () => {
    renderPage()
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )

    fireEvent.click(screen.getByRole('button', { name: /Don't have an account/ }))
    expect(screen.queryByRole('link', { name: 'Forgot your password?' })).toBeNull()
  })

  it('captures a name on signup, so emails can greet the person', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Don't have an account/ }))

    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Ana Souza' } })
    fillEmail()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2222' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    await waitFor(() => expect(signUp).toHaveBeenCalledWith('ana@example.com', 'hunter2222', 'Ana Souza'))
  })

  it('tells the user to check their inbox when signup returns no session', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Don't have an account/ }))
    fillEmail()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'hunter2222' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))

    expect(await screen.findByText(/Check your email to confirm/)).toBeInTheDocument()
    // Returns to the sign-in form until the address is confirmed.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('hides the password field in magic-link mode and sends a link', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Email me a sign-in link/ }))

    expect(screen.queryByLabelText('Password')).toBeNull()
    fillEmail()
    fireEvent.click(screen.getByRole('button', { name: 'Email me a link' }))

    await waitFor(() => expect(sendMagicLink).toHaveBeenCalledWith('ana@example.com'))
    // Phrased so it reveals nothing about whether the account exists.
    expect(await screen.findByText(/If an account exists for ana@example.com/)).toBeInTheDocument()
  })

  it('surfaces an auth failure without clearing the form', async () => {
    signIn.mockRejectedValue(new Error('Invalid login credentials'))
    renderPage()
    fillEmail()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    expect(screen.getByLabelText('Email address')).toHaveValue('ana@example.com')
  })
})
