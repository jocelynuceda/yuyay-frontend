import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import type { AuthResponse } from '../types'

const baseURL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/api/v1`
const REFRESH_TOKEN_KEY = 'yuyay.refreshToken'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface RefreshResponse extends AuthTokens {
  tokenType: string
  expiresInSeconds: number
  user: unknown
}

interface AuthRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
  _accessToken?: string | null
  _sessionVersion?: number
}

let accessToken: string | null = null
// undefined permite restaurar desde storage. null representa un cierre local explícito.
let refreshTokenInMemory: string | null | undefined
let sessionVersion = 0
let refreshPromise: Promise<AuthResponse> | null = null
let onSessionExpired: (() => void) | null = null

function storeTokens(tokens: AuthTokens) {
  refreshTokenInMemory = tokens.refreshToken
  accessToken = tokens.accessToken
  try {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  } catch {
    // Si el navegador no deja guardar, la sesión dura lo que dure la pestaña.
  }
}

/** El access token vive exclusivamente en memoria. */
export function setTokens(tokens: AuthTokens) {
  storeTokens(tokens)
  sessionVersion += 1
  refreshPromise = null
}

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  if (refreshTokenInMemory !== undefined) return refreshTokenInMemory
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearTokens() {
  accessToken = null
  refreshTokenInMemory = null
  sessionVersion += 1
  refreshPromise = null
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // El cierre local evita releer el valor persistido durante esta pestaña.
  }
}

/** AuthContext podrá registrar aquí su cierre de sesión, o null para desconectarlo. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler
}

const statusMessages: Record<number, string> = {
  400: 'Revisa los datos enviados e inténtalo de nuevo.',
  401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No se encontró lo que buscas.',
  409: 'Los datos entran en conflicto con un registro existente.',
  410: 'Este recurso o enlace ya no está disponible.',
  500: 'El servidor tuvo un problema. Inténtalo de nuevo más tarde.',
}

export function getHttpErrorMessage(error: unknown): string {
  if (axios.isCancel(error)) return 'La solicitud fue cancelada.'
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.'
    if (error.response.status >= 500) return statusMessages[500]
    const message: unknown = error.response.data?.message
    if (typeof message === 'string' && message.trim()) return message
    return statusMessages[error.response.status] ?? 'No se pudo completar la solicitud. Inténtalo de nuevo.'
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.'
}

function rejectWithFriendlyMessage(error: unknown): never {
  // Conserva response, status y fieldErrors para los consumidores actuales.
  if (axios.isAxiosError(error) && !axios.isCancel(error)) {
    error.message = getHttpErrorMessage(error)
  }
  throw error
}

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

/** No adjunta la sesión del usuario ni renueva tokens del delegado. */
export const publicApi = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

export function bearer(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

function isRefreshRequest(config: InternalAxiosRequestConfig) {
  const pathname = new URL(config.url ?? '', 'https://yuyay.invalid').pathname
  return pathname.replace(/\/+$/, '').endsWith('/auth/refresh')
}

async function refreshSession(version: number) {
  try {
    const token = getRefreshToken()
    if (!token) throw new Error('No hay una sesión para renovar.')

    // El refresh compartido es independiente del signal de cada consumidor.
    const { data } = await publicApi.post<AuthResponse>('/auth/refresh', {
      refreshToken: token,
    })
    if (version !== sessionVersion) {
      // El servidor ya rotó el token: se intenta revocar el nuevo.
      // Va por publicApi (sin el interceptor de api) y el error no es de Axios,
      // así que no se trata como 401 ni borra la sesión más reciente.
      if (typeof data?.refreshToken === 'string' && data.refreshToken) {
        void publicApi.post('/auth/logout', { refreshToken: data.refreshToken }).catch(() => {})
      }
      throw new Error('La sesión cambió.')
    }
    if (!data || typeof data.accessToken !== 'string' || !data.accessToken ||
        typeof data.refreshToken !== 'string' || !data.refreshToken) {
      throw new Error('Respuesta de sesión inválida.')
    }
    storeTokens(data)
    return data
  } catch (error) {
    // Una renovación antigua no puede borrar una sesión iniciada después.
    if (version === sessionVersion && axios.isAxiosError(error) && error.response?.status === 401) {
      clearTokens()
      try {
        onSessionExpired?.()
      } catch {
        // Un callback de UI no debe reemplazar el error de autenticación.
      }
    }
    throw error
  }
}

export function refreshAuthSession(): Promise<AuthResponse> {
  const version = sessionVersion
  if (!refreshPromise) {
    const pending = refreshSession(version).finally(() => {
      if (refreshPromise === pending) refreshPromise = null
    })
    refreshPromise = pending
  }
  return refreshPromise
}

api.interceptors.request.use((config: AuthRequestConfig) => {
  const token = getAccessToken()
  config._accessToken = token
  config._sessionVersion = sessionVersion
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || axios.isCancel(error)) throw error
    const config = error.config as AuthRequestConfig | undefined
    if (error.response?.status !== 401 || !config || config._retried || isRefreshRequest(config)) {
      return rejectWithFriendlyMessage(error)
    }
    config._retried = true

    // No reenvía peticiones de una sesión anterior con las credenciales de otra.
    if (config._sessionVersion !== sessionVersion) return rejectWithFriendlyMessage(error)

    try {
      // Un 401 tardío puede pertenecer al token que ya fue renovado.
      if (!accessToken || config._accessToken === accessToken) {
        await refreshAuthSession()
      }
    } catch {
      return rejectWithFriendlyMessage(error)
    }

    if (config._sessionVersion !== sessionVersion) return rejectWithFriendlyMessage(error)
    return api.request(config)
  },
)

publicApi.interceptors.response.use(
  (response) => response,
  rejectWithFriendlyMessage,
)
