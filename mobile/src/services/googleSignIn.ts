import { Platform } from 'react-native';

type GoogleSignInModule = typeof import('@react-native-google-signin/google-signin');

/**
 * ID de cliente **web** de Google (no es secreto). Google firma el ID token para este cliente y el
 * backend lo acepta como audiencia (GOOGLE_CLIENT_IDS). Sin él, el botón de Google no aparece.
 */
export const GOOGLE_WEB_CLIENT_ID = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();

let cached: GoogleSignInModule | null | undefined;
let configured = false;

/**
 * El módulo nativo solo existe en un APK compilado con la dependencia. En Expo Go o en la web no
 * está: se devuelve null y el resto del acceso sigue igual, sin cerrar la app.
 */
export function loadGoogleSignIn(): GoogleSignInModule | null {
  if (cached !== undefined) return cached;
  if (Platform.OS === 'web' || !GOOGLE_WEB_CLIENT_ID) return (cached = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@react-native-google-signin/google-signin') as GoogleSignInModule;
  } catch {
    cached = null;
  }
  return cached;
}

export type GoogleIdTokenResult =
  | { status: 'ok'; idToken: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/** Abre el selector de cuentas de Google y devuelve el ID token para enviarlo a Yuyay. */
export async function getGoogleIdToken(): Promise<GoogleIdTokenResult> {
  const google = loadGoogleSignIn();
  if (!google) return { status: 'error', message: 'El ingreso con Google no está disponible en esta versión de la app.' };
  const { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } = google;
  if (!configured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
    configured = true;
  }
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { status: 'cancelled' };
    const idToken = response.data.idToken;
    // La sesión de Yuyay no depende de la de Google: así la próxima vez se vuelve a elegir la cuenta.
    await GoogleSignin.signOut().catch(() => null);
    return idToken
      ? { status: 'ok', idToken }
      : { status: 'error', message: 'Google no entregó la identificación. Inténtalo de nuevo.' };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS) {
        return { status: 'cancelled' };
      }
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { status: 'error', message: 'Este teléfono no tiene los servicios de Google Play actualizados.' };
      }
    }
    return { status: 'error', message: 'No se pudo abrir Google. Inténtalo de nuevo o usa tu correo y contraseña.' };
  }
}
