import { createContext } from 'react'
import type { User } from '../types'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** Solo la restauración inicial (y retryRestore). El envío del login lo maneja cada formulario. */
  isLoading: boolean
  restoreError: string | null
  retryRestore: () => Promise<void>
  /** true si estableció la sesión; false si otro intento o el logout lo reemplazó. */
  login: (email: string, password: string) => Promise<boolean>
  register: (name: string, email: string, password: string) => Promise<boolean>
  /** Sirve para ingresar y para crear la cuenta; el backend decide si la persona ya existe. */
  loginWithGoogle: (idToken: string, acceptedTermsVersion?: string) => Promise<boolean>
  logout: () => Promise<void>
  updateUser: (changes: Partial<User>) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
