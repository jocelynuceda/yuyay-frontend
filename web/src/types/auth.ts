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

export interface TermsAcceptance {
  termsAccepted: true
  termsVersion: string
}

export interface TermsDocument {
  version: string
  text: string
}

export interface RegisterRequest extends LoginRequest, TermsAcceptance {
  name: string
  /** Opcional: quien no quiera decirlo puede saltar la pregunta. */
  gender?: Gender | null
  /** Se contrasta con el nombre en el backend; no se guarda. */
  dni: string
}

export interface GoogleAuthRequest {
  idToken: string
  /** Versión aceptada explícitamente para crear una cuenta con Google. */
  acceptedTermsVersion?: string
}

export interface AuthResponse extends RefreshResponse {
  user: User
}
