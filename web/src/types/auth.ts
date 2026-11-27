import type { CareUserSummary, Gender } from './index'
import type { RefreshResponse } from '../services/http'

export interface User extends CareUserSummary {
  /** Nombre completo del documento; `name` es el nombre de usuario. Falta en cuentas anteriores. */
  fullName?: string | null
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
  /** Nombre de usuario: el que se muestra en la app. */
  name: string
  /** El servidor solo lo usa si no puede consultar el DNI. */
  fullName: string
  /** Opcional: quien no quiera decirlo puede saltar la pregunta. */
  gender?: Gender | null
  /** Solo sirve para consultar el nombre completo; no se guarda. */
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
