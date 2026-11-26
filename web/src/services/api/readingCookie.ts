import { publicApi } from '../http'
import type { HandoffPublicView } from '../../types'

const readingPath = (token: string) => `/public/handoff-sessions/${encodeURIComponent(token)}`

export function supportsReadingCookie() {
  return window.isSecureContext && new URL(publicApi.defaults.baseURL ?? '/', window.location.href).origin === window.location.origin
}

export async function resumeReading(token: string, signal?: AbortSignal) {
  const response = await publicApi.get<HandoffPublicView>(`${readingPath(token)}/resume`, { signal })
  if (response.status === 204) return null
  const view = response.data
  // A diferencia de los enlaces anteriores, una lectura recordada siempre vence.
  if (!view?.accessExpiresAt || !view.serverTime
    || !Number.isFinite(Date.parse(view.accessExpiresAt)) || !Number.isFinite(Date.parse(view.serverTime))) {
    throw new Error('El servidor no devolvió un permiso de lectura válido.')
  }
  return view
}

export async function rememberReading(token: string, grant: string) {
  await publicApi.post(`${readingPath(token)}/reading-cookie`, null, { headers: { 'X-Handoff-Access': grant } })
  // Un navegador puede descartar Set-Cookie aun con un 204 del servidor.
  if (!await resumeReading(token)) throw new Error('Este navegador no guardó el permiso.')
}
