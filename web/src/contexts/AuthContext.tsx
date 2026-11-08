import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import * as authService from '../services/api/auth'
import {
  clearTokens,
  getHttpErrorMessage,
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
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const operation = useRef(0)
  const mounted = useRef(false)

  // Restaura la sesión con el refresh token; una operación más nueva (login/logout) gana.
  const restoreSession = useCallback(() => {
    const currentOperation = ++operation.current
    const isCurrent = () => mounted.current && operation.current === currentOperation

    return refreshAuthSession()
      .then((data) => {
        if (!isCurrent()) return

        setUser(data.user)
        setRestoreError(null)
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return

        setUser(null)
        // Si http.ts no borró el token (no fue 401), el fallo es de red o servidor y se puede reintentar.
        setRestoreError(getRefreshToken() !== null ? getHttpErrorMessage(error) : null)
      })
      .finally(() => {
        if (isCurrent()) setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    mounted.current = true

    setSessionExpiredHandler(() => {
      operation.current += 1
      setUser(null)
      setRestoreError(null)
      setIsLoading(false)
    })

    if (getRefreshToken()) void restoreSession()

    return () => {
      mounted.current = false
      operation.current += 1
      setSessionExpiredHandler(null)
    }
  }, [restoreSession])

  const retryRestore = useCallback(async () => {
    if (!getRefreshToken()) {
      setRestoreError(null)
      return
    }
    setIsLoading(true)
    setRestoreError(null)
    await restoreSession()
  }, [restoreSession])

  const authenticate = useCallback(async (request: () => Promise<AuthResponse>) => {
    const currentOperation = ++operation.current
    setIsLoading(false)
    // Un login obsoleto no debe guardar tokens; los errores le llegan al formulario.
    const data = await request()
    if (!mounted.current || operation.current !== currentOperation) return
    setTokens(data)
    setUser(data.user)
    setRestoreError(null)
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
    setRestoreError(null)
    setIsLoading(false)
    try {
      await authService.logout(refreshToken)
    } catch {
      // El cierre local ya está completo aunque falle la revocación en el servidor.
    }
  }, [])

  const updateUser = useCallback((changes: Partial<User>) => {
    setUser((current) => (current ? { ...current, ...changes } : current))
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: user !== null,
    isLoading,
    restoreError,
    retryRestore,
    login,
    register,
    logout,
    updateUser,
  }), [user, isLoading, restoreError, retryRestore, login, register, logout, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

