import axios from 'axios'
import { getHttpErrorMessage } from '../services/http'

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

/** El backend pide aceptar los términos (cuenta nueva). Devuelve la versión vigente si la envía. */
export function googleTermsRequired(error: unknown): { currentVersion: string | null } | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 428) return null
  const version: unknown = error.response.data?.currentVersion
  return { currentVersion: typeof version === 'string' && version.trim() ? version : null }
}

/** Mensaje claro para cada fallo del ingreso con Google. */
export function googleErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && error.response) {
    switch (error.response.status) {
      case 400:
      case 401:
        return GOOGLE_INVALID_TOKEN
      case 404:
      case 405:
      case 501:
        return GOOGLE_UNAVAILABLE
      case 409:
        return GOOGLE_PASSWORD_ACCOUNT
      case 428:
        return GOOGLE_TERMS_REQUIRED
    }
  }
  return getHttpErrorMessage(error)
}

/**
 * Pide los términos a la persona y devuelve la versión aceptada, o null si cancela.
 * Lo entrega el modal de términos; mientras no exista, el alta con Google muestra el aviso.
 */
export type RequestTermsAcceptance = (currentVersion: string | null) => Promise<string | null>

export type GoogleSignInResult =
  | { status: 'signed-in' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

/**
 * Completa el ingreso con la credencial de Google. Si la cuenta es nueva y el backend exige los
 * términos, los pide y reintenta una sola vez con la versión aceptada.
 */
export async function completeGoogleSignIn(
  credential: string | undefined,
  signIn: (idToken: string, acceptedTermsVersion?: string) => Promise<boolean>,
  requestTerms?: RequestTermsAcceptance,
): Promise<GoogleSignInResult> {
  if (!credential) return { status: 'error', message: GOOGLE_INVALID_TOKEN }
  try {
    return { status: await signIn(credential) ? 'signed-in' : 'cancelled' }
  } catch (error) {
    const terms = googleTermsRequired(error)
    if (!terms || !requestTerms) return { status: 'error', message: googleErrorMessage(error) }

    const accepted = await requestTerms(terms.currentVersion)
    if (!accepted) return { status: 'cancelled' }
    try {
      return { status: await signIn(credential, accepted) ? 'signed-in' : 'cancelled' }
    } catch (retryError) {
      return { status: 'error', message: googleErrorMessage(retryError) }
    }
  }
}
