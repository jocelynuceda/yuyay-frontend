import { useState } from 'react'
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import {
  completeGoogleSignIn,
  GOOGLE_CLIENT_ID,
  GOOGLE_POPUP_ERROR,
  GOOGLE_SCRIPT_ERROR,
  type RequestTermsAcceptance,
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
  requestTerms,
  clientId = GOOGLE_CLIENT_ID,
}: {
  mode: 'login' | 'register'
  onSignedIn: () => void
  onError: (message: string) => void
  /** Se llama al recibir la credencial, para limpiar errores anteriores. */
  onStart?: () => void
  requestTerms?: RequestTermsAcceptance
  clientId?: string
}) {
  const { loginWithGoogle } = useAuth()
  const { resolved } = useTheme()
  const [busy, setBusy] = useState(false)
  // Google dibuja el botón con un ancho fijo (de 200 a 400 px): se ajusta al espacio disponible.
  const [width, setWidth] = useState<number | null>(null)

  if (!clientId) return null

  return (
    <div className="grid gap-4">
      <div
        ref={(element) => {
          if (element && width === null) setWidth(Math.min(400, Math.max(200, Math.floor(element.clientWidth))))
        }}
        className="flex min-h-11 justify-center"
        aria-busy={busy}
      >
        {width === null ? null : (
          <GoogleOAuthProvider clientId={clientId} locale="es" onScriptLoadError={() => onError(GOOGLE_SCRIPT_ERROR)}>
            <GoogleLogin
              onSuccess={async ({ credential }) => {
                onStart?.()
                setBusy(true)
                const result = await completeGoogleSignIn(credential, loginWithGoogle, requestTerms)
                setBusy(false)
                if (result.status === 'signed-in') onSignedIn()
                else if (result.status === 'error') onError(result.message)
              }}
              onError={() => onError(GOOGLE_POPUP_ERROR)}
              text={mode === 'register' ? 'signup_with' : 'signin_with'}
              theme={resolved === 'dark' ? 'filled_black' : 'outline'}
              shape="pill"
              size="large"
              width={width}
            />
          </GoogleOAuthProvider>
        )}
      </div>
      {busy ? (
        <p role="status" className="text-center text-sm text-muted">
          Conectando con Google…
        </p>
      ) : null}
      <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />o con tu correo
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  )
}
