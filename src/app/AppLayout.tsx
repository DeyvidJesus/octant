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

  // Mark the feed seen on leaving the board, not on arrival, or the "N new" digest would vanish at once.
  const markFeedSeen = useDiscoveryStore((state) => state.markSeen)
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    if (previousPath.current === FEED_PATH && location.pathname !== FEED_PATH) markFeedSeen()
    previousPath.current = location.pathname
  }, [location.pathname, markFeedSeen])

  // Once per app open, run discovery if the user's cadence says it is due.
  useEffect(() => {
    const timer = setTimeout(() => maybeRunSessionHeartbeat(), 2500)
    return () => clearTimeout(timer)
  }, [])

  return (
    // print: overrides let a long document flow across pages instead of clipping to the viewport.
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
        {/* Mobile top bar; hidden from md: up, where the rail is permanent. */}
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
