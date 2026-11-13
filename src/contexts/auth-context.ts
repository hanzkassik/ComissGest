import type { User } from 'firebase/auth'
import { createContext } from 'react'

export interface AuthContextValue {
  currentUser: User | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
