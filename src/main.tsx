import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/index.css'
import { App } from '@/app/App'
import { initSentry, Sentry } from '@/services/monitoring/sentry'
import { initAnalytics } from '@/services/analytics/analytics'

// Observability must start before the app renders so early crashes and pageviews are captured.
initSentry()
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center p-8 text-center text-muted">
          <div>
            <p className="text-white font-medium mb-1">Something went wrong.</p>
            <p className="text-sm">The error has been reported. Please reload the page.</p>
          </div>
        </div>
      }
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
