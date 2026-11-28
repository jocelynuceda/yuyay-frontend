import { useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useAuth } from '../../hooks/useAuth'
import { useFetch } from '../../hooks/useFetch'
import { getCareAuthorizationPolicy } from '../../services/api/careSubjects'
import { exchangeProfileClaim } from '../../services/api/profileClaims'
import {
  acquireClaimAttempt, clearClaimToken, releaseClaimAttempt,
  getClaimToken, rememberClaimToken,
} from '../../utils/profileClaim'
import { linkClass, linkSecondaryClass } from '../../utils/styles'
import { LoadError } from '../../components/layout/LoadError'

export default function ProfileClaimRoute() {
  const { token } = useParams()
  return token ? <CaptureToken token={token} /> : <ProfileClaimPage />
}

function CaptureToken({ token }: { token: string }) {
  const navigate = useNavigate()
  useLayoutEffect(() => {
    rememberClaimToken(token)
    void navigate('/entrega', { replace: true, state: null })
  }, [navigate, token])
  return <p role="status" className="p-6">Preparando la entrega…</p>
}

export function ProfileClaimPage() {
  const { user } = useAuth()
  const [token] = useState(getClaimToken)
  return (
    <main className="mx-auto grid max-w-2xl gap-5 px-4 py-10 sm:px-6">
      <Link to="/" className={linkClass}>Yuyay · Inicio</Link>
      <Card className="grid gap-5">
        <h1 className="text-3xl font-semibold">Recibir mi perfil</h1>
        <p>La persona que te cuida te invitó a administrar tu perfil en Yuyay. Abrir este enlace no transfiere el perfil.</p>
        {!token ? (
          <>
            <p role="alert">Vuelve a abrir el enlace del correo para continuar. Por seguridad no guardamos su token al recargar o cerrar esta página.</p>
            <p>Si un canje anterior quedó sin confirmar, comprueba primero tus personas: podría haberse completado.</p>
            <Link to="/people" className={linkSecondaryClass}>Consultar mis personas</Link>
          </>
        ) : user ? (
          <Recipient key={user.id} userId={user.id} email={user.email} token={token} />
        ) : (
          <>
            <p>Inicia sesión con el mismo correo que recibió la invitación. Todavía no se mostrará información del perfil.</p>
            <div className="flex flex-wrap gap-3">
              <Link to="/login" state={{ from: { pathname: '/entrega' } }} className={linkSecondaryClass}>Iniciar sesión</Link>
              <Link to="/register" state={{ from: { pathname: '/entrega' } }} className={linkSecondaryClass}>Crear una cuenta</Link>
            </div>
          </>
        )}
      </Card>
    </main>
  )
}

function Recipient({ userId, email, token }: { userId: number; email: string; token: string }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  function switchAccount() {
    const go = () => void navigate('/login', { replace: true, state: { from: { pathname: '/entrega' } } })
    void logout().then(go, go)
  }
  const policy = useFetch(getCareAuthorizationPolicy, [])
  const [confirmed, setConfirmed] = useState(false)
  const model = useMemo(() => acquireClaimAttempt(userId, token, () => exchangeProfileClaim(token)), [userId, token])
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot)
  const self = policy.data?.options.find((option) => option.type === 'SELF')

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      const phase = model.getSnapshot().phase
      if (phase === 'saving' || phase === 'uncertain') {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('beforeunload', warn)
      if (['saved', 'resolved'].includes(model.getSnapshot().phase)) {
        clearClaimToken(token)
        releaseClaimAttempt(userId, token)
      }
    }
  }, [model, userId, token])

  if (state.phase === 'checking') return <p role="status">Comprobando esta revisión de entrega…</p>

  if (state.phase === 'resolved') return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">Revisión cerrada</h2>
      <p role="status">Marcaste esta revisión como comprobada. Esto no cancela ni vuelve a enviar una entrega recibida por el servidor.</p>
      <Link to="/people" className={linkSecondaryClass}>Consultar mis personas</Link>
    </div>
  )

  if (state.phase === 'saved' && state.result) return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold">Ya administras tu perfil</h2>
      <p role="status">La entrega se completó. Eres el titular y cuidador principal de {state.result.name}.</p>
      <p>Los cuidadores anteriores conservan el acceso que definió el servidor. Puedes gestionarlos desde tu perfil.</p>
      <Link to={'/people/' + state.result.careSubjectId + '?tab=caregivers'} replace className={linkSecondaryClass}>Abrir mi perfil y revisar cuidadores</Link>
    </div>
  )

  if (state.phase === 'uncertain') return (
    <div className="grid gap-4">
      <p role="alert">{state.message}</p>
      <Link to="/people" onClick={model.visitHistory} className={linkSecondaryClass}>Comprobar mis personas</Link>
      <Button variant="secondary" disabled={!state.historyVisited} onClick={model.acknowledgeHistory}>Ya comprobé mis personas; cerrar revisión</Button>
      <p className="text-sm text-muted">Al salir conservaremos este resultado incierto mientras la aplicación siga abierta. Si recargas o cierras, consulta tus personas antes de volver al correo.</p>
    </div>
  )

  if (state.phase === 'failed') return (
    <div className="grid gap-4">
      <p role="alert">{state.message}</p>
      <p>Comprueba que estás usando el correo destinatario. Si el enlace venció, fue revocado o ya se usó, solicita a quien te cuida que revise su estado.</p>
      <Button variant="secondary" onClick={switchAccount}>Usar otra cuenta</Button>
      <Link to="/people" className={linkSecondaryClass}>Consultar mis personas</Link>
    </div>
  )

  if (state.historyRequired) return (
    <div className="grid gap-4">
      <p role="alert">Una entrega anterior puede haberse completado. Comprueba tus personas antes de continuar con este enlace.</p>
      <Link to="/people" onClick={model.visitHistory} className={linkClass}>Consultar mis personas</Link>
      <Button disabled={!state.historyVisited} onClick={model.acknowledgeHistory}>Ya comprobé mis personas; continuar</Button>
    </div>
  )

  return (
    <div className="grid gap-4">
      <p>Sesión actual: <strong className="[overflow-wrap:anywhere]">{email}</strong>. Debe coincidir con el correo invitado.</p>
      <p>Al confirmar serás titular y principal del perfil. Los principales anteriores pasarán a cuidadores; conservarán acceso hasta que decidas modificarlo. Los registros y sus autores se conservan.</p>
      <p className="text-sm text-muted">El contraste de un nombre no acredita identidad ni verifica edad. El servidor vuelve a comprobar las condiciones de la entrega.</p>
      {policy.loading ? <p role="status">Consultando la declaración vigente…</p> : policy.error ? (
        <LoadError message={policy.error} status={policy.errorStatus} onRetry={policy.reload} />
      ) : self?.confirmationText ? (
        <fieldset disabled={state.phase === 'saving'} className="grid gap-3">
          <legend className="mb-2 font-semibold">Tu declaración</legend>
          <p>{self.description}</p>
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>{self.confirmationText}</span>
          </label>
          <Button disabled={!confirmed} loading={state.phase === 'saving'} onClick={() => void model.submit()}>
            {state.phase === 'saving' ? 'Completando entrega…' : 'Confirmar y recibir mi perfil'}
          </Button>
        </fieldset>
      ) : <p role="alert">La declaración no está disponible. Vuelve a consultar antes de continuar.</p>}
      {state.phase === 'saving' ? <p role="status">Espera el resultado. Salir no cancela una entrega ya recibida por el servidor.</p> : null}
      <Button variant="ghost" disabled={state.phase === 'saving'} onClick={switchAccount}>Usar otra cuenta</Button>
    </div>
  )
}
