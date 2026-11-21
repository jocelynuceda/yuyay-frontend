import { createContext } from 'react'
import type { User } from '../types'
import type { RegisterRequest, TermsAcceptance } from '../types/auth'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** Solo la restauración inicial (y retryRestore). El envío del login lo maneja cada formulario. */
  isLoading: boolean
  restoreError: string | null
  retryRestore: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (request: RegisterRequest) => Promise<void>
  /** Sirve para ingresar y para crear la cuenta; el backend decide si la persona ya existe. */
  loginWithGoogle: (idToken: string, acceptance?: TermsAcceptance) => Promise<void>
  logout: () => Promise<void>
  updateUser: (changes: Partial<User>) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
