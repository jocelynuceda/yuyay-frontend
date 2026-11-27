import { api } from '../http'
import type { ClaimExchangeResponse, ClaimInvitation, IdentityCheckResponse } from '../../types/profileClaim'

export async function listClaimInvitations(subjectId: number, signal?: AbortSignal) {
  const { data } = await api.get<ClaimInvitation[]>('/care-subjects/' + subjectId + '/claim-invitations', { signal })
  return data
}

export async function emitClaimInvitation(subjectId: number, invitedEmail: string) {
  const { data } = await api.post<ClaimInvitation>('/care-subjects/' + subjectId + '/claim-invitations', { invitedEmail })
  return data
}

export async function revokeClaimInvitation(subjectId: number, invitationId: number) {
  await api.delete('/care-subjects/' + subjectId + '/claim-invitations/' + invitationId)
}

export async function checkSubjectName(subjectId: number, dni: string) {
  const { data } = await api.post<IdentityCheckResponse>('/care-subjects/' + subjectId + '/identity-check', { dni })
  return data
}

export async function exchangeProfileClaim(token: string) {
  const { data } = await api.post<ClaimExchangeResponse>('/claim-invitations/exchange', { token })
  return data
}
