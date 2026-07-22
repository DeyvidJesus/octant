import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { OnboardingModal } from '@/components/onboarding/OnboardingModal'
import { Toaster } from '@/components/ui/Toaster'

export function AppLayout() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  // Close the mobile drawer on navigation.
  useEffect(() => setNavOpen(false), [location.pathname])

  return (
    // print: overrides let a full document (e.g. a tailored resume) flow across
    // pages instead of being clipped to one screen-height viewport.
    <div className="flex h-screen bg-base text-ink font-sans overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <OnboardingModal />

      {/* Mobile drawer backdrop */}
      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden print:hidden"
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
            className="text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
          >
            <Menu size={22} aria-hidden />
          </button>
          <span className="font-semibold tracking-tight">Career OS</span>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative print:overflow-visible">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  )
}
