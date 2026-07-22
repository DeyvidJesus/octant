import { NavLink } from 'react-router-dom'
import type { NavEntry } from '@/constants/navigation'

/** Optional count badge (e.g. unseen discovery opportunities) shown on the right of the item. */
export function NavItem({ entry, badge }: { entry: NavEntry; badge?: number }) {
  const Icon = entry.icon
  return (
    <NavLink
      to={entry.path}
      end={entry.path === '/'}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          isActive
            ? 'bg-surface-2 text-white font-medium border-edge-2'
            : 'text-muted hover:bg-surface hover:text-ink-2 border-transparent'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={16} className={isActive ? 'text-white' : 'text-faint'} aria-hidden />
          <span className="flex-1">{entry.label}</span>
          {badge !== undefined && badge > 0 && (
            <span
              className="min-w-5 text-center text-[10px] font-semibold text-black bg-emerald-400 rounded-full px-1.5 py-0.5"
              aria-label={`${badge} new`}
            >
              {badge > 99 ? '99+' : badge}
            </span>
          )}
          {entry.planned && (
            <span className="text-[9px] uppercase tracking-wider text-faint border border-edge rounded px-1 py-0.5">
              Soon
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}
