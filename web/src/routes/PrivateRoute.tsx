import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function RouteLoading() {
  return <p role="status" className="px-6 py-10 text-center text-muted">Cargando…</p>
}

export default function PrivateRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <RouteLoading />
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}
