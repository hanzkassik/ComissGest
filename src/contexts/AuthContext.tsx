import { onAuthStateChanged, type User } from 'firebase/auth'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { firebaseAuth } from '../firebase/auth'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(firebaseAuth, (user) => {
    setCurrentUser(user)
    setLoading(false)
  }), [])

  const value = useMemo(() => ({ currentUser, loading }), [currentUser, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
