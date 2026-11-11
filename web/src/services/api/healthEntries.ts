import { api } from '../http'
import type {
  HealthEntry,
  HealthEntryCreateRequest,
  HealthEntryListParams,
  HealthEntryUpdateRequest,
  HealthEntryVersion,
  Page,
} from '../../types'

const base = (careSubjectId: number) => `/care-subjects/${careSubjectId}/health-entries`

/** Registros paginados. Orden por defecto createdAt,desc; size 10. */
export async function listHealthEntries(careSubjectId: number, params: HealthEntryListParams = {}, signal?: AbortSignal) {
  const { data } = await api.get<Page<HealthEntry>>(base(careSubjectId), { params, signal })
  return data
}

export async function getHealthEntry(careSubjectId: number, entryId: number, signal?: AbortSignal) {
  const { data } = await api.get<HealthEntry>(`${base(careSubjectId)}/${entryId}`, { signal })
  return data
}

export async function createHealthEntry(careSubjectId: number, request: HealthEntryCreateRequest) {
  const { data } = await api.post<HealthEntry>(base(careSubjectId), request)
  return data
}

export async function updateHealthEntry(careSubjectId: number, entryId: number, request: HealthEntryUpdateRequest) {
  const { data } = await api.patch<HealthEntry>(`${base(careSubjectId)}/${entryId}`, request)
  return data
}

export async function deleteHealthEntry(careSubjectId: number, entryId: number) {
  await api.delete(`${base(careSubjectId)}/${entryId}`)
}

/** De la versión más nueva a la más antigua. */
export async function listHealthEntryVersions(careSubjectId: number, entryId: number, signal?: AbortSignal) {
  const { data } = await api.get<HealthEntryVersion[]>(`${base(careSubjectId)}/${entryId}/versions`, { signal })
  return data
}
