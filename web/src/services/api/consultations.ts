import { api } from '../http'
import type {
  Consultation,
  ConsultationDetail,
  ConsultationRequest,
  ConsultationUpdate,
  HealthEntryVersion,
} from '../../types'

const base = (careSubjectId: number) => `/care-subjects/${careSubjectId}/consultations`

/** Ordenadas por fecha descendente. */
export async function listConsultations(careSubjectId: number, signal?: AbortSignal) {
  const { data } = await api.get<Consultation[]>(base(careSubjectId), { signal })
  return data
}

export async function createConsultation(careSubjectId: number, request: ConsultationRequest) {
  const { data } = await api.post<ConsultationDetail>(base(careSubjectId), request)
  return data
}

export async function updateConsultation(consultationId: number, request: ConsultationUpdate) {
  const { data } = await api.patch<ConsultationDetail>(`/consultations/${consultationId}`, request)
  return data
}

export async function deleteConsultation(consultationId: number) {
  await api.delete(`/consultations/${consultationId}`)
}

/** Versiones declaradas después de la fecha de esa consulta. 404 si la consulta no existe. */
export async function listChangesSinceConsultation(careSubjectId: number, sinceConsultationId: number, signal?: AbortSignal) {
  const { data } = await api.get<HealthEntryVersion[]>(`${base(careSubjectId)}/changes`, {
    params: { sinceConsultationId },
    signal,
  })
  return data
}
