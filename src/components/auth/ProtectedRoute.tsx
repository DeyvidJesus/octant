import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/useAuth'

export function ProtectedRoute() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ink-strong" role="status" aria-label="Loading" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
