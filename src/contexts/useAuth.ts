import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
}

// Lives apart from `AuthProvider` so that file exports only a component (React Fast Refresh requires it).
export const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  isLoading: true,
})

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
