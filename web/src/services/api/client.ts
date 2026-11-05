import axios from 'axios'

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')

/** Cliente para la API autenticada. Provisional hasta tener el cliente/auth de la base. */
export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

/** Cliente sin token para las rutas /public y para el delegado (que usa su propio token). */
export const publicApi = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

let getAccessToken: () => string | null = () => null

/** La base (login) registra aquí de dónde sacar el token del usuario. */
export function setAccessTokenGetter(getter: () => string | null) {
  getAccessToken = getter
}

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export function bearer(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } }
}
