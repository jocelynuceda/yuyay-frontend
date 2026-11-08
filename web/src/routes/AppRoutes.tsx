import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NotFoundPage from '../pages/NotFoundPage'
import PrivateRoute, { RouteLoading } from './PrivateRoute'

const LoginPage = lazy(() => import('../pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'))
const PeopleRoute = lazy(() => import('../pages/people/PeopleRoute'))
const DelegateAccessPage = lazy(() => import('../pages/public/DelegateAccessPage')
  .then(({ DelegateAccessPage }) => ({ default: DelegateAccessPage })))
const HandoffPublicPage = lazy(() => import('../pages/public/HandoffPublicPage')
  .then(({ HandoffPublicPage }) => ({ default: HandoffPublicPage })))

function HomeRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <RouteLoading />
  return <Navigate to={isAuthenticated ? '/personas' : '/login'} replace />
}

function PublicAuthRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <RouteLoading />
  return isAuthenticated ? <Navigate to="/personas" replace /> : <Outlet />
}

function DelegateRoute() {
  const { token } = useParams()
  return token ? <DelegateAccessPage token={token} /> : <NotFoundPage />
}

function HandoffRoute() {
  const { token } = useParams()
  return token ? <HandoffPublicPage token={token} /> : <NotFoundPage />
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route element={<PublicAuthRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
        </Route>
        <Route path="/acceso/:token" element={<DelegateRoute />} />
        <Route path="/traspaso/:token" element={<HandoffRoute />} />
        <Route element={<PrivateRoute />}>
          <Route path="/personas" element={<PeopleRoute />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
