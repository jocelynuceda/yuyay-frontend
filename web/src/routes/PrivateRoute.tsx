import { lazy } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const LandingPage = lazy(() => import('../pages/landing/LandingPage'))

/** Rutas con sesión. Sin sesión, el inicio («/») muestra la landing y las demás rutas llevan al login. */
export default function PrivateRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (isAuthenticated) return <Outlet />
  if (location.pathname === '/') return <LandingPage />
  return <Navigate to="/login" replace state={{ from: location }} />
}
