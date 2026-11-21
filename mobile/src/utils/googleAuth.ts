import { ApiError } from '../services/client.ts';

// Mismos mensajes que la web (web/src/utils/googleAuth.ts) para el contrato de POST /auth/google.

export const GOOGLE_INVALID_TOKEN = 'Google no pudo confirmar tu identidad. Vuelve a intentarlo.';
export const GOOGLE_UNAVAILABLE = 'El ingreso con Google no está disponible en este momento. Usa tu correo y contraseña.';
export const GOOGLE_PASSWORD_ACCOUNT = 'Este correo ya tiene una cuenta con contraseña. Ingresa con tu correo y contraseña.';
export const GOOGLE_TERMS_REQUIRED =
  'Aún no tienes una cuenta en Yuyay. Para crearla con Google lee y acepta los términos de uso y el aviso de privacidad.';
export const GOOGLE_SIGN_IN_FAILED = 'No se pudo abrir Google. Inténtalo de nuevo o usa tu correo y contraseña.';

export type GoogleOutcome = { kind: 'terms' } | { kind: 'error'; message: string };

/**
 * Qué hacer ante un error de POST /auth/google. Un 428 con código de términos significa que la cuenta
 * es nueva: se muestran los términos y se reintenta con la versión aceptada.
 */
export function classifyGoogleError(error: unknown): GoogleOutcome {
  if (!(error instanceof ApiError)) return { kind: 'error', message: GOOGLE_SIGN_IN_FAILED };
  if (error.status === 428 && (error.code === 'TERMS_ACCEPTANCE_REQUIRED' || error.code === 'TERMS_VERSION_OUTDATED')) {
    return { kind: 'terms' };
  }
  if (error.code === 'GOOGLE_EMAIL_CONFLICT') return { kind: 'error', message: error.message };
  switch (error.status) {
    case 401:
      return { kind: 'error', message: GOOGLE_INVALID_TOKEN };
    case 404:
    case 405:
    case 501:
    case 503:
      return { kind: 'error', message: GOOGLE_UNAVAILABLE };
    case 409:
      return { kind: 'error', message: GOOGLE_PASSWORD_ACCOUNT };
    default:
      return { kind: 'error', message: error.message };
  }
}
