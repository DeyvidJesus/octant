import { create } from 'zustand'

export interface ConfirmOptions {
  message: string
  title?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
}

interface ConfirmState {
  request: ConfirmOptions | null
  _resolve: ((value: boolean) => void) | null
  /** Opens the dialog and resolves true (confirmed) / false (cancelled). */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /** Called by the dialog buttons / Escape. */
  respond: (value: boolean) => void
}

/** Themeable, promise-based replacement for window.confirm. Rendered by <ConfirmDialog/>. */
export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  _resolve: null,
  confirm: (options) =>
    new Promise<boolean>((resolve) => {
      // If a prior request is somehow open, resolve it as cancelled before replacing.
      get()._resolve?.(false)
      set({ request: options, _resolve: resolve })
    }),
  respond: (value) => {
    get()._resolve?.(value)
    set({ request: null, _resolve: null })
  },
}))

/** Convenience wrapper so call sites can `await confirm({ ... })` without touching the store. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().confirm(options)
}
