import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import { AuthProvider } from '@/contexts/AuthContext'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
