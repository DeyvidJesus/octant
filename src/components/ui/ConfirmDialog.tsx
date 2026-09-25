import { useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useConfirmStore } from '@/stores/confirmStore'

/** Renders the active confirm request as an accessible modal. Mounted once in AppLayout. */
export function ConfirmDialog() {
  const request = useConfirmStore((state) => state.request)
  const respond = useConfirmStore((state) => state.respond)

  useEffect(() => {
    if (!request) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') respond(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request, respond])

  if (!request) return null

  const danger = request.tone === 'danger'

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-scrim/60 backdrop-blur-sm p-4 print:hidden"
      onClick={() => respond(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="border-edge-2 shadow-2xl bg-surface p-6">
          {request.title && (
            <h2 id="confirm-title" className="text-lg font-semibold text-ink-strong mb-2">
              {request.title}
            </h2>
          )}
          <p id={request.title ? undefined : 'confirm-title'} className="text-sm text-ink-2 leading-relaxed mb-6">
            {request.message}
          </p>
          <div className="flex items-center justify-end gap-3">
            <Button variant="ghost" onClick={() => respond(false)}>
              {request.cancelLabel ?? 'Cancel'}
            </Button>
            <Button
              autoFocus
              variant="primary"
              className={danger ? 'bg-danger-strong text-ink-strong hover:bg-danger' : ''}
              onClick={() => respond(true)}
            >
              {request.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
