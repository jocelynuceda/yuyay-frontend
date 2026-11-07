import { createContext } from 'react'
import type { User } from '../types'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** Solo la restauración inicial (y retryRestore). El envío del login lo maneja cada formulario. */
  isLoading: boolean
  restoreError: string | null
  retryRestore: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
