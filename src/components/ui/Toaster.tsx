import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useToastStore, type Toast } from '@/stores/toastStore'

const TONE_CLASSES: Record<Toast['tone'], string> = {
  error: 'border-red-500/30 bg-red-500/10 text-red-300',
  info: 'border-edge-2 bg-surface-2 text-ink-2',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
}

const AUTO_DISMISS_MS = 6000

function ToastRow({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm animate-rise-in ${TONE_CLASSES[toast.tone]}`}
    >
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}

/** Renders active toasts bottom-right. Mounted once in AppLayout. */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-full max-w-sm print:hidden" aria-live="polite">
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
