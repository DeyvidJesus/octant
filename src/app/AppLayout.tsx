import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { APP_NAME } from '@/constants/brand'
import { Sidebar } from '@/components/layout/Sidebar'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { Toaster } from '@/components/ui/Toaster'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { maybeRunSessionHeartbeat } from '@/stores/discoveryRunner'
import { useDiscoveryStore } from '@/stores/discoveryStore'

/** The route that hosts the discovery review queue. */
const FEED_PATH = '/jobs'

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer on navigation.
  useEffect(() => setNavOpen(false), [location.pathname])

  // Mark the discovery feed as seen when the user LEAVES the board, so the sidebar badge and the
  // "N new since you last looked" digest count only what arrived after this visit. Marking on arrival
  // would hide the digest the moment it is shown.
  const markFeedSeen = useDiscoveryStore((state) => state.markSeen)
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    if (previousPath.current === FEED_PATH && location.pathname !== FEED_PATH) markFeedSeen()
    previousPath.current = location.pathname
  }, [location.pathname, markFeedSeen])

  // Session heartbeat: once the app is open (stores hydrated by ProtectedRoute), let the discovery
  // agent quietly advance if the user is due per their cadence. Runs once per app open; cadence-gated.
  useEffect(() => {
    const timer = setTimeout(() => maybeRunSessionHeartbeat(), 2500)
    return () => clearTimeout(timer)
  }, [])

  return (
    // print: overrides let a full document (e.g. a tailored resume) flow across
    // pages instead of being clipped to one screen-height viewport.
    <div className="flex h-screen bg-base text-ink font-sans overflow-hidden print:h-auto print:overflow-visible print:bg-paper">
      <OnboardingModal />

      {/* Mobile drawer backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-scrim/60 md:hidden print:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
        {/* Mobile top bar with the drawer toggle (hidden from md: up, where the rail is permanent). */}
        <header className="md:hidden flex items-center gap-3 border-b border-edge bg-base px-4 h-14 shrink-0 print:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            aria-expanded={navOpen}
            className="text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-strong rounded"
          >
            <Menu size={22} aria-hidden />
          </button>
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative print:overflow-visible">
          <Outlet />
        </main>
      </div>

      <Toaster />
      <ConfirmDialog />
    </div>
  )
}
