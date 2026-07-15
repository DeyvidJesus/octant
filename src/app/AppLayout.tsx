import { Outlet } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'

export function AppLayout() {
  return (
    <div className="flex h-screen bg-base text-ink font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <Outlet />
      </main>
    </div>
  )
}
