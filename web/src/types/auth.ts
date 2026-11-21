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
}

/** Las cuentas ya vinculadas envían solo la credencial de Google. */
export type GoogleAuthRequest = { idToken: string } & (
  TermsAcceptance | { termsAccepted?: never; termsVersion?: never }
)

export interface AuthResponse extends RefreshResponse {
  user: User
}
