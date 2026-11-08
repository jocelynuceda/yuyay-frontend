import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as authService from '../services/api/auth'
import {
  clearTokens,
  getRefreshToken,
  refreshAuthSession,
  setSessionExpiredHandler,
  setTokens,
} from '../services/http'
import type { AuthResponse, User } from '../types'
import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(() => getRefreshToken() !== null)
  const operation = useRef(0)
  const mounted = useRef(false)

  useEffect(() => {
    mounted.current = true
    const currentOperation = ++operation.current
    const isCurrent = () => mounted.current && operation.current === currentOperation

    setSessionExpiredHandler(() => {
      operation.current += 1
      setUser(null)
      setIsLoading(false)
    })

    const refreshToken = getRefreshToken()
    if (refreshToken) {
      void refreshAuthSession()
        .then((data) => {
          if (!isCurrent()) return

          setUser(data.user)
        })
        .catch(() => {
          if (!isCurrent()) return

          setUser(null)
        })
        .finally(() => {
          if (isCurrent()) setIsLoading(false)
        })
    }

    return () => {
      mounted.current = false
      operation.current += 1
      setSessionExpiredHandler(null)
    }
  }, [])

  const authenticate = useCallback(async (request: () => Promise<AuthResponse>) => {
    const currentOperation = ++operation.current
    setIsLoading(true)
    try {
      const data = await request()
      if (!mounted.current || operation.current !== currentOperation) return
      setTokens(data)
      setUser(data.user)
    } finally {
      if (mounted.current && operation.current === currentOperation) setIsLoading(false)
    }
  }, [])

  const login = useCallback((email: string, password: string) =>
    authenticate(() => authService.login({ email, password })), [authenticate])

  const register = useCallback((name: string, email: string, password: string) =>
    authenticate(() => authService.register({ name, email, password })), [authenticate])

  const logout = useCallback(async () => {
    const refreshToken = getRefreshToken()
    operation.current += 1
    clearTokens()
    setUser(null)
    setIsLoading(false)
    try {
      await authService.logout(refreshToken)
    } catch {
      // El cierre local ya está completo aunque falle la revocación en el servidor.
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    register,
    logout,
  }), [user, isLoading, login, register, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

