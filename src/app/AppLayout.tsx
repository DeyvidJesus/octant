import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'

export function AppLayout() {
  return (
    // print: overrides let a full document (e.g. a tailored resume) flow across
    // pages instead of being clipped to one screen-height viewport.
    <div className="flex h-screen bg-base text-ink font-sans overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar relative print:overflow-visible">
        <Outlet />
      </main>
    </div>
  )
}
