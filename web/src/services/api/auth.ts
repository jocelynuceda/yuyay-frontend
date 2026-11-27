import { getRefreshToken, publicApi } from '../http'
import type { AuthResponse, GoogleAuthRequest, LoginRequest, RegisterRequest } from '../../types'
import type { TermsDocument } from '../../types/auth'

export async function getTerms(signal?: AbortSignal): Promise<TermsDocument> {
  const { data } = await publicApi.get<TermsDocument>('/auth/terms', { signal })
  return data
}

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const { data } = await publicApi.post<AuthResponse>('/auth/login', request)
  return data
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const { data } = await publicApi.post<AuthResponse>('/auth/register', request)
  return data
}

/** Nombre que figura en el DNI, para que la persona confirme que es ella. */
export async function lookupDni(dni: string, signal?: AbortSignal): Promise<{ fullName: string }> {
  const { data } = await publicApi.post<{ fullName: string }>('/auth/dni-lookup', { dni }, { signal })
  return data
}

/** El backend verifica el ID token con Google y devuelve una sesión normal de Yuyay. */
export async function loginWithGoogle(request: GoogleAuthRequest): Promise<AuthResponse> {
  const { data } = await publicApi.post<AuthResponse>('/auth/google', request)
  return data
}

/** Responde igual exista o no la cuenta. */
export async function forgotPassword(email: string): Promise<void> {
  await publicApi.post('/auth/forgot-password', { email })
}

export async function resetPassword(request: { email: string; code: string; newPassword: string }): Promise<void> {
  await publicApi.post('/auth/reset-password', request)
}

export async function logout(refreshToken: string | null = getRefreshToken()): Promise<void> {
  if (!refreshToken) return
  await publicApi.post('/auth/logout', { refreshToken })
}
