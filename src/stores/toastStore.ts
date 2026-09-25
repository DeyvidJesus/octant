import { create } from 'zustand'
import { createId } from '@/utils/id'

export type ToastTone = 'error' | 'info' | 'success'

export interface Toast {
  id: string
  message: string
  tone: ToastTone
}

interface ToastState {
  toasts: Toast[]
  notify: (message: string, tone?: ToastTone) => void
  dismiss: (id: string) => void
}

/** Minimal toast bus; `persist()` uses it to surface save failures. */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  notify: (message, tone = 'info') =>
    set((state) => {
      // Collapse duplicates so a burst of failed writes doesn't stack identical toasts.
      if (state.toasts.some((toast) => toast.message === message)) return state
      return { toasts: [...state.toasts, { id: createId(), message, tone }] }
    }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))
