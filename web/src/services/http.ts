import axios, { CanceledError } from 'axios'
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import type { AuthResponse } from '../types'

const baseURL = `${(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')}/api/v1`
const REFRESH_TOKEN_KEY = 'yuyay.refreshToken'

/** Tiempo máximo de espera de cada petición, en milisegundos. */
export const REQUEST_TIMEOUT_MS = 15000
/** Reintentos automáticos máximos para lecturas idempotentes. */
export const MAX_RETRIES = 2
/** Espera base del reintento; se duplica en cada intento (300, 600, ...). */
export const RETRY_BASE_DELAY_MS = 300

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
  // Cuenta los reintentos por red/5xx; es independiente de _retried (flujo 401).
  _retryCount?: number
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
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'El servidor tardó demasiado en responder. Inténtalo de nuevo.'
    }
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
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

/** No adjunta la sesión del usuario ni renueva tokens del delegado. */
export const publicApi = axios.create({
  baseURL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
})

export function bearer(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}

function isRefreshRequest(config: InternalAxiosRequestConfig) {
  const pathname = new URL(config.url ?? '', 'https://yuyay.invalid').pathname
  return pathname.replace(/\/+$/, '').endsWith('/auth/refresh')
}

// Los timeouts (ECONNABORTED/ETIMEDOUT) no se reintentan: la petición ya esperó
// REQUEST_TIMEOUT_MS, así que el peor caso de espera es aproximadamente un timeout.
const RETRYABLE_CODES = ['ERR_NETWORK']
const RETRYABLE_STATUSES = [502, 503, 504]

function isRetryable(error: AxiosError, config: AuthRequestConfig) {
  if (axios.isCancel(error)) return false
  const method = (config.method ?? 'get').toLowerCase()
  if (method !== 'get' && method !== 'head') return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  if (isRefreshRequest(config)) return false
  if (!error.response) return error.code !== undefined && RETRYABLE_CODES.includes(error.code)
  return RETRYABLE_STATUSES.includes(error.response.status)
}

/** Espera ms; si el signal se aborta antes o durante la espera, rechaza con CanceledError. */
function waitWithSignal(ms: number, config: AuthRequestConfig): Promise<void> {
  const signal = config.signal as AbortSignal | null | undefined
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new CanceledError<unknown>(undefined, config))
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(new CanceledError<unknown>(undefined, config))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Reintenta lecturas idempotentes ante fallos de red o 502/503/504 (no timeouts).
 * Devuelve null si el error no es reintentable o se agotaron los intentos.
 * La petición reintentada vuelve a pasar por el interceptor de request (token actual).
 */
async function retryRequest(
  instance: AxiosInstance,
  error: unknown,
): Promise<AxiosResponse | null> {
  if (!axios.isAxiosError(error)) return null
  const config = error.config as AuthRequestConfig | undefined
  if (!config || !isRetryable(error, config)) return null
  const attempt = (config._retryCount ?? 0) + 1
  if (attempt > MAX_RETRIES) return null
  // Un reintento nunca debe salir con el token de otro usuario.
  const sessionChanged = () =>
    config._sessionVersion !== undefined && config._sessionVersion !== sessionVersion
  if (sessionChanged()) throw new CanceledError<unknown>('La sesión cambió.', config)
  config._retryCount = attempt
  await waitWithSignal(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), config)
  if (sessionChanged()) throw new CanceledError<unknown>('La sesión cambió.', config)
  return instance.request(config)
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
    // Un error reintentable nunca es un 401, así que va antes de la lógica de sesión.
    const retried = await retryRequest(api, error)
    if (retried) return retried
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
  async (error: unknown) => {
    const retried = await retryRequest(publicApi, error)
    if (retried) return retried
    return rejectWithFriendlyMessage(error)
  },
)
