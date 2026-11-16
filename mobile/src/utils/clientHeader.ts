export const CLIENT_HEADER = 'X-Yuyay-Client';

/**
 * Valor de X-Yuyay-Client: plataforma, versión de la app y origen del código.
 * Sufijo tras el '+':
 * - e<8 caracteres del updateId>: código que viajó dentro del APK (lanzamiento embebido).
 * - u<8 caracteres del updateId>: actualización OTA descargada después.
 * - dev: Expo Go o build de desarrollo (sin updateId).
 * El backend solo acepta [A-Za-z0-9._/+-] y 64 caracteres como máximo.
 */
export function clientHeaderValue(
  platform: string,
  appVersion?: string | null,
  updateId?: string | null,
  embeddedLaunch?: boolean | null,
): string {
  const id = (updateId ?? '').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  const source = id ? `${embeddedLaunch === true ? 'e' : 'u'}${id}` : 'dev';
  return `${platform}/${appVersion || 'unknown'}+${source}`
    .replace(/[^A-Za-z0-9._/+-]/g, '')
    .slice(0, 64);
}
