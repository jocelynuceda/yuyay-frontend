import { useContext } from 'react'
import { AuthContext } from '../contexts/auth-context'
import type { AuthContextValue } from '../contexts/auth-context'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider.')
  return context
}
