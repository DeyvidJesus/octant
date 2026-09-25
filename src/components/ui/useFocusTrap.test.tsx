// @vitest-environment happy-dom
import { useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

function Modal({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open)
  if (!open) return null
  return (
    <div ref={ref} role="dialog" tabIndex={-1}>
      <button type="button">First</button>
      <button type="button" disabled>
        Disabled
      </button>
      <button type="button">Last</button>
    </div>
  )
}

function Page({ open }: { open: boolean }) {
  return (
    <>
      <button type="button">Opener</button>
      <Modal open={open} />
    </>
  )
}

afterEach(cleanup)

describe('useFocusTrap', () => {
  it('moves focus into the dialog when it opens', () => {
    render(<Page open />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps Tab from the last element to the first, skipping disabled ones', () => {
    render(<Page open />)
    const last = screen.getByRole('button', { name: 'Last' })
    last.focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
  })

  it('wraps Shift+Tab from the first element to the last', () => {
    render(<Page open />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus()
  })

  it('returns focus to the element that had it before the dialog opened', () => {
    const { rerender } = render(<Page open={false} />)
    const opener = screen.getByRole('button', { name: 'Opener' })
    opener.focus()
    rerender(<Page open />)
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus()
    rerender(<Page open={false} />)
    expect(opener).toHaveFocus()
  })
})
