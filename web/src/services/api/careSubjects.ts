import { api } from '../http'
import type {
  AccessLog,
  CareAuthorizationDeclaration,
  CareAuthorizationDeclarationRequest,
  CareAuthorizationPolicy,
  CareAuthorizationUpdateRequest,
  CareSubject,
  CareSubjectRequest,
  Page,
  PageParams,
} from '../../types'

export async function listCareSubjects(signal?: AbortSignal) {
  const { data } = await api.get<CareSubject[]>('/care-subjects', { signal })
  return data
}

export async function getCareSubject(id: number, signal?: AbortSignal) {
  const { data } = await api.get<CareSubject>(`/care-subjects/${id}`, { signal })
  return data
}

/**
 * Alta con la declaración de autorización. `requestId` se mantiene al reintentar la misma alta,
 * así el backend devuelve el mismo perfil en vez de duplicarlo.
 */
export async function createCareSubject(
  request: CareSubjectRequest & { declaration: CareAuthorizationDeclarationRequest; requestId: string },
) {
  const { data } = await api.post<CareSubject>('/care-subjects', request)
  return data
}

/** Textos y opciones vigentes de la declaración, con su versión. */
export async function getAuthorizationPolicy(signal?: AbortSignal) {
  const { data } = await api.get<CareAuthorizationPolicy>('/care-subjects/authorization-policy', { signal })
  return data
}

/** Historial de declaraciones, la más reciente primero. Solo el cuidador principal. */
export async function listAuthorizationDeclarations(careSubjectId: number, signal?: AbortSignal) {
  const { data } = await api.get<CareAuthorizationDeclaration[]>(
    `/care-subjects/${careSubjectId}/authorization-declarations`,
    { signal },
  )
  return data
}

export async function declareAuthorization(careSubjectId: number, request: CareAuthorizationUpdateRequest) {
  const { data } = await api.post<CareAuthorizationDeclaration>(
    `/care-subjects/${careSubjectId}/authorization-declarations`,
    request,
  )
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
export async function listAccessLogs(careSubjectId: number, params: PageParams = {}, signal?: AbortSignal) {
  const { data } = await api.get<Page<AccessLog>>(`/care-subjects/${careSubjectId}/access-logs`, { params, signal })
  return data
}
