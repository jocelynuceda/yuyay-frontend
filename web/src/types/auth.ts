import type { CareUserSummary, Gender } from './index'
import type { RefreshResponse } from '../services/http'

export interface User extends CareUserSummary {
  /** Nombre completo del documento; `name` es el nombre de usuario. Falta en cuentas anteriores. */
  fullName?: string | null
  role: string
  gender?: Gender | null
  createdAt: string
  /** Opcional; con ella se calcula la edad y el avatar automático. */
  birthDate?: string | null
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
  /** Nombres y apellidos escritos por la persona para contrastarlos en el registro. */
  fullName: string
  /** Opcional: quien no quiera decirlo puede saltar la pregunta. */
  gender?: Gender | null
  /** Se usa durante el alta para contrastar el nombre escrito. */
  dni: string
}

export type RegistrationIdentity = Pick<RegisterRequest, 'dni' | 'fullName' | 'name'>

export interface GoogleAuthRequest extends Partial<RegistrationIdentity> {
  idToken: string
  /** Versión aceptada explícitamente para crear una cuenta con Google. */
  acceptedTermsVersion?: string
}

export interface AuthResponse extends RefreshResponse {
  user: User
}
