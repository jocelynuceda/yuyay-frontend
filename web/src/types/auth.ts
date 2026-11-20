import type { CareUserSummary, Gender } from './index'
import type { RefreshResponse } from '../services/http'

export interface User extends CareUserSummary {
  role: string
  gender?: Gender | null
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {
  name: string
}

/** Ingreso o alta con la credencial (ID token) que entrega Google. */
export interface GoogleAuthRequest {
  idToken: string
  /** Solo al crear una cuenta nueva: versión de los términos que la persona aceptó. */
  acceptedTermsVersion?: string
}

export interface AuthResponse extends RefreshResponse {
  user: User
}
