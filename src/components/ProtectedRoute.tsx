import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoadingSkeleton } from './LoadingSkeleton'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth()
  if (loading) return <LoadingSkeleton variant="app" />
  if (!currentUser) return <Navigate to="/login" replace />
  return children
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth()
  if (loading) return <LoadingSkeleton variant="app" />
  if (currentUser) return <Navigate to="/empresas" replace />
  return children
}
