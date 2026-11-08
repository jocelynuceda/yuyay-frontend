import { api } from '../http'
import type { CareInviteRequest, CareRelationship } from '../../types'

export async function listCaregivers(careSubjectId: number) {
  const { data } = await api.get<CareRelationship[]>(`/care-subjects/${careSubjectId}/relationships`)
  return data
}

export async function inviteCaregiver(careSubjectId: number, request: CareInviteRequest) {
  const { data } = await api.post<CareRelationship>(`/care-subjects/${careSubjectId}/relationships`, request)
  return data
}

export async function removeCaregiver(careSubjectId: number, relationshipId: number) {
  await api.delete(`/care-subjects/${careSubjectId}/relationships/${relationshipId}`)
}

export async function listMyPendingInvitations(signal?: AbortSignal) {
  const { data } = await api.get<CareRelationship[]>('/me/relationships/pending', { signal })
  return data
}

export async function acceptInvitation(relationshipId: number) {
  const { data } = await api.post<CareRelationship>(`/me/relationships/${relationshipId}/accept`)
  return data
}
