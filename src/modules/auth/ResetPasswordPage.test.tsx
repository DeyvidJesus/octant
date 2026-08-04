// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResetPasswordPage } from './ResetPasswordPage'

/**
 * The ordering assertions here are the point. The "your password changed" email must be sent ONLY after
 * the update succeeds — telling someone their password changed when it didn't is worse for a security
 * notice than sending nothing, and it would train users to ignore the real one.
 */

const updatePassword = vi.fn()
const sendPasswordChangedEmail = vi.fn()
const navigate = vi.fn()

vi.mock('@/services/supabase/auth', () => ({
  updatePassword: (...args: unknown[]) => updatePassword(...args),
}))

vi.mock('@/services/email/notifications', () => ({
  sendPasswordChangedEmail: () => sendPasswordChangedEmail(),
}))

let mockSession: object | null = { user: { id: 'u1' } }
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: mockSession, user: null, isLoading: false }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

function submit(password: string, confirmation = password) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
}

beforeEach(() => {
  mockSession = { user: { id: 'u1' } }
  updatePassword.mockResolvedValue(undefined)
  sendPasswordChangedEmail.mockResolvedValue(true)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ResetPasswordPage', () => {
  it('updates the password and then sends the notice', async () => {
    renderPage()
    submit('a-good-password')

    await waitFor(() => expect(updatePassword).toHaveBeenCalledWith('a-good-password'))
    expect(sendPasswordChangedEmail).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('does NOT send the notice when the update fails', async () => {
    updatePassword.mockRejectedValue(new Error('Password is too weak'))
    renderPage()
    submit('a-good-password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Password is too weak')
    expect(sendPasswordChangedEmail).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('rejects a too-short password before calling the server', () => {
    renderPage()
    submit('short')

    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters')
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('rejects mismatched confirmation before calling the server', () => {
    renderPage()
    submit('a-good-password', 'a-different-password')

    expect(screen.getByRole('alert')).toHaveTextContent("don't match")
    expect(updatePassword).not.toHaveBeenCalled()
  })

  it('explains the expiry instead of showing a dead form when there is no recovery session', () => {
    mockSession = null
    renderPage()

    expect(screen.getByText('This reset link has expired')).toBeInTheDocument()
    expect(screen.queryByLabelText('New password')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Request a new link' }))
    expect(navigate).toHaveBeenCalledWith('/forgot-password')
  })
})
