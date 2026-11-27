import axios from 'axios'
import { needsTermsReview } from '../hooks/useAccountTerms'
import { getHttpErrorMessage } from '../services/http'
import type { RegistrationIdentity, TermsAcceptance } from '../types/auth'

/**
 * ID de cliente web de Google (no es un secreto). Si falta, el botón de Google no se muestra y el
 * acceso con correo y contraseña sigue igual.
 */
export const GOOGLE_CLIENT_ID: string = (import.meta.env?.VITE_GOOGLE_CLIENT_ID ?? '').trim()

export const GOOGLE_POPUP_ERROR = 'No se pudo abrir Google. Revisa que el navegador permita ventanas emergentes e inténtalo de nuevo.'
export const GOOGLE_SCRIPT_ERROR =
  'No se pudo cargar el ingreso con Google. Revisa tu conexión o usa tu correo y contraseña.'
export const GOOGLE_PASSWORD_ACCOUNT =
  'Este correo ya tiene una cuenta con contraseña. Ingresa con tu correo y contraseña.'
export const GOOGLE_INVALID_TOKEN = 'Google no pudo confirmar tu identidad. Vuelve a intentarlo.'
export const GOOGLE_UNAVAILABLE = 'El ingreso con Google todavía no está disponible. Usa tu correo y contraseña.'
export const GOOGLE_TERMS_REQUIRED =
  'Aún no tienes una cuenta en Yuyay. Para crearla con Google debes aceptar los términos y la política de privacidad.'

/** Mensaje claro para cada fallo del ingreso con Google. */
export function googleErrorMessage(error: unknown): string {
  if (needsTermsReview(error, 428)) return GOOGLE_TERMS_REQUIRED
  if (axios.isAxiosError(error) && error.response) {
    const code: unknown = error.response.data?.code
    if (code === 'GOOGLE_EMAIL_CONFLICT') return getHttpErrorMessage(error)
    switch (error.response.status) {
      case 401:
        return GOOGLE_INVALID_TOKEN
      case 404:
      case 405:
      case 501:
      case 503:
        return GOOGLE_UNAVAILABLE
      case 409:
        return GOOGLE_PASSWORD_ACCOUNT
    }
  }
  return getHttpErrorMessage(error)
}

/**
 * Pide los términos a la persona y devuelve la aceptación, o null si cancela.
 */
export type RequestTermsAcceptance = () => Promise<TermsAcceptance | null>

export type GoogleSignInResult =
  | { status: 'signed-in' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

/**
 * Una cuenta nueva puede requerir términos y datos del DNI. Cada reintento espera
 * una acción de la persona. La segunda revisión cubre un cambio de versión de términos.
 */
export async function completeGoogleSignIn(
  credential: string | undefined,
  signIn: (idToken: string, acceptance?: TermsAcceptance, identity?: RegistrationIdentity) => Promise<boolean>,
  requestTerms?: RequestTermsAcceptance,
  requestIdentity?: (error?: unknown) => Promise<RegistrationIdentity | null>,
): Promise<GoogleSignInResult> {
  if (!credential) return { status: 'error', message: GOOGLE_INVALID_TOKEN }
  let acceptance: TermsAcceptance | undefined
  let identity: RegistrationIdentity | undefined
  let reviews = 0
  for (;;) {
    try {
      return { status: await signIn(credential, acceptance, identity) ? 'signed-in' : 'cancelled' }
    } catch (error) {
      if (requestTerms && reviews < 2 && needsTermsReview(error, 428)) {
        reviews++
        const accepted = await requestTerms()
        if (!accepted) return { status: 'cancelled' }
        acceptance = accepted
        continue
      }
      const response = axios.isAxiosError(error) ? error.response : undefined
      const needsIdentity = response?.status === 428 && response.data?.code === 'REGISTRATION_DETAILS_REQUIRED'
      const canCorrect = identity && axios.isAxiosError(error) && (
        !response || [400, 429, 503].includes(response.status)
      )
      if (requestIdentity && (needsIdentity || canCorrect)) {
        const supplied = await requestIdentity(needsIdentity ? undefined : error)
        if (!supplied) return { status: 'cancelled' }
        identity = supplied
        continue
      }
      return { status: 'error', message: googleErrorMessage(error) }
    }
  }
}
