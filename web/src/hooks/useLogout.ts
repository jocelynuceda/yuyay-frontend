import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

/** Cierra la sesión y lleva a /login. */
export function useLogout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  return useCallback(async () => {
    await logout()
    void navigate('/login', { replace: true })
  }, [logout, navigate])
}
