import { api } from './client'
import type {
  HealthCategory,
  HealthEntry,
  HealthEntryCreateRequest,
  HealthEntryListParams,
  HealthEntryUpdateRequest,
  HealthEntryVersion,
  Page,
} from '../../types'

const base = (careSubjectId: number) => `/care-subjects/${careSubjectId}/health-entries`

export async function listHealthCategories() {
  const { data } = await api.get<HealthCategory[]>('/health-categories')
  return data
}

/** Registros paginados. Orden por defecto createdAt,desc; size 10. */
export async function listHealthEntries(careSubjectId: number, params: HealthEntryListParams = {}) {
  const { data } = await api.get<Page<HealthEntry>>(base(careSubjectId), { params })
  return data
}

export async function getHealthEntry(careSubjectId: number, entryId: number) {
  const { data } = await api.get<HealthEntry>(`${base(careSubjectId)}/${entryId}`)
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
export async function listHealthEntryVersions(careSubjectId: number, entryId: number) {
  const { data } = await api.get<HealthEntryVersion[]>(`${base(careSubjectId)}/${entryId}/versions`)
  return data
}
