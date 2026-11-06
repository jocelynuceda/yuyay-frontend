import type { CareUserSummary } from './index'
import type { RefreshResponse } from '../services/http'

export interface User extends CareUserSummary {
  role: string
  createdAt: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {
  name: string
}

export interface AuthResponse extends RefreshResponse {
  user: User
}
