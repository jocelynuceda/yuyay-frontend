import { useEffect, useRef, useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { AccountTermsDialog, TermsCheckbox } from '../../components/AccountTerms'
import { Button } from '../../components/ui/Button'
import { useAccountTerms } from '../../hooks/useAccountTerms'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import type { RegistrationIdentity, TermsAcceptance } from '../../types/auth'
import { GoogleRegistrationDialog } from './GoogleRegistrationDialog'
import {
  completeGoogleSignIn,
  GOOGLE_CLIENT_ID,
  GOOGLE_POPUP_ERROR,
  GOOGLE_SCRIPT_ERROR,
  googleErrorMessage,
} from '../../utils/googleAuth'

/**
 * Botón oficial de Google para ingresar o crear la cuenta. Google entrega un ID token y el backend
 * lo cambia por la sesión normal de Yuyay. Si no hay ID de cliente configurado, no se muestra nada.
 */
export function GoogleSignIn({
  mode,
  onSignedIn,
  onError,
  onStart,
  clientId = GOOGLE_CLIENT_ID,
}: {
  mode: 'login' | 'register'
  onSignedIn: () => void
  onError: (message: string) => void
  /** Se llama al recibir la credencial, para limpiar errores anteriores. */
  onStart?: () => void
  clientId?: string
}) {
  const { loginWithGoogle } = useAuth()
  const { resolved } = useTheme()
  const terms = useAccountTerms()
  const mounted = useRef(false)
  const running = useRef(false)
  const resolveTerms = useRef<((acceptance: TermsAcceptance | null) => void) | null>(null)
  const resolveIdentity = useRef<((identity: RegistrationIdentity | null) => void) | null>(null)
  const [identityPrompt, setIdentityPrompt] = useState<{ error?: unknown; saving: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  // Google dibuja el botón con un ancho fijo (de 200 a 400 px): se ajusta al espacio disponible.
  const [width, setWidth] = useState<number | null>(null)
  const buttonContainer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = buttonContainer.current
    if (!element) return
    const measure = () => setWidth(Math.min(400, Math.max(200, Math.floor(element.clientWidth))))
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [clientId])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      resolveTerms.current?.(null)
      resolveTerms.current = null
      resolveIdentity.current?.(null)
      resolveIdentity.current = null
    }
  }, [])

  function requestTerms() {
    if (!mounted.current) return Promise.resolve(null)
    terms.review()
    return new Promise<TermsAcceptance | null>((resolve) => { resolveTerms.current = resolve })
  }

  function finishTerms(acceptance: TermsAcceptance | null) {
    const resolve = resolveTerms.current
    resolveTerms.current = null
    terms.close()
    resolve?.(acceptance)
  }

  function requestIdentity(error?: unknown) {
    if (!mounted.current) return Promise.resolve(null)
    setIdentityPrompt({ error, saving: false })
    return new Promise<RegistrationIdentity | null>((resolve) => { resolveIdentity.current = resolve })
  }

  function finishIdentity(identity: RegistrationIdentity | null) {
    const resolve = resolveIdentity.current
    if (!resolve) return
    resolveIdentity.current = null
    setIdentityPrompt(identity ? { saving: true } : null)
    resolve(identity)
  }

  async function handleCredential(credential?: string) {
    if (!mounted.current || running.current) return
    running.current = true
    onStart?.()
    setBusy(true)
    try {
      const result = await completeGoogleSignIn(credential, loginWithGoogle, requestTerms, requestIdentity)
      if (!mounted.current) return
      if (result.status === 'signed-in') onSignedIn()
      else if (result.status === 'error') onError(result.message)
    } catch (error) {
      if (mounted.current) onError(googleErrorMessage(error))
    } finally {
      running.current = false
      if (mounted.current) {
        setBusy(false)
        setIdentityPrompt(null)
      }
    }
  }

  if (!clientId) return null

  return (
    <div className="grid min-w-0 gap-4">
      <div
        ref={buttonContainer}
        className="flex min-h-11 min-w-0 justify-center"
        aria-busy={busy}
      >
        {width === null ? null : (
          <GoogleOAuthProvider clientId={clientId} locale="es" onScriptLoadError={() => onError(GOOGLE_SCRIPT_ERROR)}>
            <GoogleLogin
              onSuccess={({ credential }) => void handleCredential(credential)}
              onError={() => onError(GOOGLE_POPUP_ERROR)}
              text={mode === 'register' ? 'signup_with' : 'signin_with'}
              theme={resolved === 'dark' ? 'filled_black' : 'outline'}
              shape="pill"
              size="large"
              width={width}
              // El iframe de Google usa un documento claro incluso con el botón oscuro.
              // Igualar su color-scheme evita el fondo blanco opaco alrededor del botón.
              containerProps={{ style: { colorScheme: 'light' } }}
            />
          </GoogleOAuthProvider>
        )}
      </div>
      {busy && !identityPrompt ? (
        <p role="status" className="text-center text-sm text-muted">
          Conectando con Google…
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />o con tu correo
        <span className="h-px flex-1 bg-line" />
      </div>
      <AccountTermsDialog terms={terms} onClose={() => finishTerms(null)}>
        <div className="mt-4 grid gap-4 border-t border-black/15 pt-4">
          <TermsCheckbox terms={terms} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button className="border border-black/20 bg-white! text-black!" variant="secondary" onClick={() => finishTerms(null)}>
              Cancelar
            </Button>
            <Button className="border border-black/20 bg-slate-100! text-black!" disabled={!terms.acceptance} onClick={() => finishTerms(terms.acceptance)}>
              Continuar con Google
            </Button>
          </div>
        </div>
      </AccountTermsDialog>
      {identityPrompt && <GoogleRegistrationDialog {...identityPrompt} onFinish={finishIdentity} />}
    </div>
  )
}
