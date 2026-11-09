import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import NotFoundPage from '../pages/NotFoundPage'
import { getPostLoginTarget } from '../utils/redirect'
import PrivateRoute from './PrivateRoute'
import SessionRoute, { RouteLoading } from './SessionRoute'

const AppLayout = lazy(() => import('../components/layout/AppLayout'))
const LoginPage = lazy(() => import('../pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'))
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'))
const NotificationsPage = lazy(() => import('../pages/notifications/NotificationsPage'))
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'))
const InvitationPage = lazy(() => import('../pages/invitations/InvitationPage'))
const PeopleRoute = lazy(() => import('../pages/people/PeopleRoute'))
const PersonDetailRoute = lazy(() => import('../pages/people/PersonDetailRoute'))
const EntryDetailRoute = lazy(() => import('../pages/entries/EntryDetailRoute'))
const DocumentReviewRoute = lazy(() => import('../pages/documents/DocumentReviewRoute'))
const NewHandoffRoute = lazy(() => import('../pages/handoff/NewHandoffRoute'))
const DelegateAccessPage = lazy(() => import('../pages/public/DelegateAccessPage')
  .then(({ DelegateAccessPage }) => ({ default: DelegateAccessPage })))
const HandoffPublicPage = lazy(() => import('../pages/public/HandoffPublicPage')
  .then(({ HandoffPublicPage }) => ({ default: HandoffPublicPage })))

function PublicAuthRoute() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  // Al autenticarse se redirige aquí antes que el navigate del formulario: debe usar el mismo destino.
  return isAuthenticated ? <Navigate to={getPostLoginTarget(location.state)} replace /> : <Outlet />
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
        <Route path="/acceso/:token" element={<DelegateRoute />} />
        <Route path="/traspaso/:token" element={<HandoffRoute />} />
        <Route element={<SessionRoute />}>
          <Route element={<PublicAuthRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
          </Route>
          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/personas" element={<PeopleRoute />} />
              <Route path="/personas/:id" element={<PersonDetailRoute />} />
              <Route path="/personas/:id/registros/:entryId" element={<EntryDetailRoute />} />
              <Route path="/personas/:id/documentos/:attachmentId" element={<DocumentReviewRoute />} />
              <Route path="/personas/:id/traspaso/nuevo" element={<NewHandoffRoute />} />
              <Route path="/avisos" element={<NotificationsPage />} />
              <Route path="/perfil" element={<ProfilePage />} />
              <Route path="/invitaciones/:id" element={<InvitationPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
