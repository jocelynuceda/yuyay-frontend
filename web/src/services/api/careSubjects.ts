import { api } from '../http'
import type { AccessLog, CareSubject, CareSubjectRequest, Page, PageParams } from '../../types'
import type { CareAuthorizationDeclaration, CareAuthorizationInput, CareAuthorizationPolicy, CareSubjectCreation } from '../../types/careAuthorization'

export async function listCareSubjects(signal?: AbortSignal) {
  const { data } = await api.get<CareSubject[]>('/care-subjects', { signal })
  return data
}

export async function getCareSubject(id: number, signal?: AbortSignal) {
  const { data } = await api.get<CareSubject>(`/care-subjects/${id}`, { signal })
  return data
}

export async function getCareAuthorizationPolicy(signal?: AbortSignal) {
  const { data } = await api.get<CareAuthorizationPolicy>('/care-subjects/authorization-policy', { signal })
  return data
}

export async function getCareAuthorizationHistory(id: number, signal?: AbortSignal) {
  const { data } = await api.get<CareAuthorizationDeclaration[]>(`/care-subjects/${id}/authorization-declarations`, { signal })
  return data
}

export async function createCareSubject({ data: fields, declaration, requestId }: CareSubjectCreation<CareSubjectRequest>) {
  const { data } = await api.post<CareSubject>('/care-subjects', { ...fields, requestId, declaration })
  return data
}

export async function registerFirstDeclaration(id: number, declaration: CareAuthorizationInput) {
  await api.post(`/care-subjects/${id}/authorization-declarations`, { ...declaration, previousDeclarationId: null })
}

export async function updateCareSubject(id: number, request: CareSubjectRequest) {
  const { data } = await api.patch<CareSubject>(`/care-subjects/${id}`, request)
  return data
}

export async function deleteCareSubject(id: number) {
  await api.delete(`/care-subjects/${id}`)
}

/** Bitácora paginada (solo PRINCIPAL). Orden por defecto occurredAt,desc; size 20. */
export async function listAccessLogs(careSubjectId: number, params: PageParams = {}, signal?: AbortSignal) {
  const { data } = await api.get<Page<AccessLog>>(`/care-subjects/${careSubjectId}/access-logs`, { params, signal })
  return data
}
