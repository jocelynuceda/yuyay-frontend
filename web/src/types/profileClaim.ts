import type { CareRole } from './index'

export interface ClaimInvitation {
  id: number
  careSubjectId: number
  invitedEmail: string
  validUntil: string
  exchangedAt: string | null
  revokedAt: string | null
  pending: boolean
}

export interface ClaimExchangeResponse {
  careSubjectId: number
  name: string
  role: CareRole
  claimedAt: string
}

export type IdentityCheckResult = 'MATCH' | 'MISMATCH' | 'NOT_FOUND' | 'UNAVAILABLE'
export interface IdentityCheckResponse {
  result: IdentityCheckResult
  checkedAt: string
}
