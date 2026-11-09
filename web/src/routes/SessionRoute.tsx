import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { focusRing } from '../utils/styles'

export function RouteLoading() {
  return <p role="status" className="px-6 py-10 text-center text-muted">Cargando…</p>
}

export default function SessionRoute() {
  const { isLoading, restoreError, retryRestore, logout } = useAuth()
  const navigate = useNavigate()

  if (isLoading) return <RouteLoading />
  if (!restoreError) return <Outlet />

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-3 text-2xl font-semibold">No pudimos restaurar tu sesión</h1>
      <p role="alert" className="text-muted">{restoreError}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          className={`rounded-xl bg-primary px-5 py-2.5 font-semibold text-white ${focusRing}`}
          onClick={() => void retryRestore()}
        >
          Reintentar
        </button>
        <button
          type="button"
          className={`rounded-xl border border-line px-5 py-2.5 font-semibold ${focusRing}`}
          onClick={() => {
            void logout()
            void navigate('/login', { replace: true })
          }}
        >
          Iniciar sesión de nuevo
        </button>
      </div>
    </main>
  )
}
