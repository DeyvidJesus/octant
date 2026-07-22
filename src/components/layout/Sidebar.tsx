import { useState } from 'react'
import { LogOut, X } from 'lucide-react'
import { NAV_ENTRIES } from '@/constants/navigation'
import { NavItem } from './NavItem'
import { useAuth } from '@/contexts/AuthContext'
import { signOut } from '@/services/supabase/auth'
import { useDiscoveryStore } from '@/stores/discoveryStore'
import { countUnseen } from '@/services/discovery/proactivity'

/** Two-letter avatar initials derived from the user's name (metadata) or email. */
function initialsFor(name: string | undefined, email: string | undefined): string {
  const source = (name ?? email ?? '').trim()
  if (!source) return '·'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters = parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2)
  return letters.toUpperCase()
}

interface SidebarProps {
  /** Drawer open state (mobile only; the rail is always visible from `md:` up). */
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const { user } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const unseen = useDiscoveryStore((state) => countUnseen(state.candidates, state.lastSeenAt))

  const name = (user?.user_metadata?.name as string | undefined) ?? undefined
  const email = user?.email ?? undefined
  const initials = initialsFor(name, email)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <aside
      className={`w-64 border-r border-edge bg-base flex flex-col shrink-0 print:hidden z-40 transition-transform duration-200 max-md:fixed max-md:inset-y-0 max-md:left-0 md:translate-x-0 ${
        open ? 'translate-x-0' : 'max-md:-translate-x-full'
      }`}
    >
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-white text-black flex items-center justify-center font-bold text-sm">
            {initials}
          </div>
          <h1 className="font-semibold text-lg tracking-tight">Career OS</h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="md:hidden text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      <nav
        aria-label="Modules"
        className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar"
        onClick={() => onClose?.()}
      >
        {NAV_ENTRIES.map((entry) => (
          <NavItem key={entry.path} entry={entry} badge={entry.path === '/jobs' ? unseen : undefined} />
        ))}
      </nav>

      <div className="p-4 border-t border-edge">
        {email && (
          <p className="px-2 mb-2 text-xs text-muted truncate" title={email}>
            {name ?? email}
          </p>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm text-muted hover:text-ink hover:bg-surface transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
        >
          <LogOut size={16} aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </aside>
  )
}
