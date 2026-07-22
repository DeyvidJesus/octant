// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { Toaster } from './Toaster'
import { useToastStore } from '@/stores/toastStore'

afterEach(() => {
  cleanup()
  useToastStore.setState({ toasts: [] })
})

describe('Toaster', () => {
  it('renders a notified message and dismisses it', () => {
    render(<Toaster />)
    expect(screen.queryByText('Save failed')).toBeNull()

    act(() => {
      useToastStore.getState().notify('Save failed', 'error')
    })
    expect(screen.getByText('Save failed')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Save failed')).toBeNull()
  })

  it('collapses duplicate messages into one toast', () => {
    render(<Toaster />)
    act(() => {
      useToastStore.getState().notify('Same message', 'error')
      useToastStore.getState().notify('Same message', 'error')
    })
    expect(screen.getAllByText('Same message')).toHaveLength(1)
  })
})
