import { api } from '../http'
import type { AccessLog, CareSubject, CareSubjectRequest, Page, PageParams } from '../../types'

export async function listCareSubjects(signal?: AbortSignal) {
  const { data } = await api.get<CareSubject[]>('/care-subjects', { signal })
  return data
}

export async function getCareSubject(id: number) {
  const { data } = await api.get<CareSubject>(`/care-subjects/${id}`)
  return data
}

export async function createCareSubject(request: CareSubjectRequest) {
  const { data } = await api.post<CareSubject>('/care-subjects', request)
  return data
}

export async function updateCareSubject(id: number, request: CareSubjectRequest) {
  const { data } = await api.patch<CareSubject>(`/care-subjects/${id}`, request)
  return data
}

export async function deleteCareSubject(id: number) {
  await api.delete(`/care-subjects/${id}`)
}

/** Bitácora paginada (solo PRINCIPAL). Orden por defecto occurredAt,desc; size 20. */
export async function listAccessLogs(careSubjectId: number, params: PageParams = {}) {
  const { data } = await api.get<Page<AccessLog>>(`/care-subjects/${careSubjectId}/access-logs`, { params })
  return data
}
