import { getRefreshToken, publicApi } from '../http'
import type { AuthResponse, LoginRequest, RegisterRequest } from '../../types'

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const { data } = await publicApi.post<AuthResponse>('/auth/login', request)
  return data
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const { data } = await publicApi.post<AuthResponse>('/auth/register', request)
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
