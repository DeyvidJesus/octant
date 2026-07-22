// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'
import { confirm, useConfirmStore } from '@/stores/confirmStore'

afterEach(() => {
  cleanup()
  useConfirmStore.setState({ request: null, _resolve: null })
})

describe('ConfirmDialog', () => {
  it('renders nothing until a confirm() request is opened', () => {
    render(<ConfirmDialog />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('resolves true when the confirm button is clicked', async () => {
    render(<ConfirmDialog />)
    let pending!: Promise<boolean>
    act(() => {
      pending = confirm({ title: 'Delete?', message: 'Remove this item?', confirmLabel: 'Delete', tone: 'danger' })
    })

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Remove this item?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await expect(pending).resolves.toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('resolves false when cancelled', async () => {
    render(<ConfirmDialog />)
    let pending!: Promise<boolean>
    act(() => {
      pending = confirm({ message: 'Sure?' })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await expect(pending).resolves.toBe(false)
  })

  it('resolves false on Escape', async () => {
    render(<ConfirmDialog />)
    let pending!: Promise<boolean>
    act(() => {
      pending = confirm({ message: 'Sure?' })
    })

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    await expect(pending).resolves.toBe(false)
  })
})
