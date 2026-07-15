import { NAV_ENTRIES } from '@/constants/navigation'
import { NavItem } from './NavItem'

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-edge bg-base flex flex-col shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-md bg-white text-black flex items-center justify-center font-bold text-sm">
            DG
          </div>
          <h1 className="font-semibold text-lg tracking-tight">Career OS</h1>
        </div>
        <p className="text-xs text-muted tracking-widest uppercase">System v3.0</p>
      </div>

      <nav aria-label="Modules" className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {NAV_ENTRIES.map((entry) => (
          <NavItem key={entry.path} entry={entry} />
        ))}
      </nav>

      <div className="p-4 border-t border-edge">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-xs text-muted">Local-first · All data on this device</span>
        </div>
      </div>
    </aside>
  )
}
