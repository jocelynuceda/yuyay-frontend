import { api } from '../http'
import type { ConsultationPreparation, ConfirmPreparation } from '../../types/consultationPreparation'
import type {
  Consultation,
  ConsultationDetail,
  ConsultationRequest,
  ConsultationUpdate,
  HealthEntryVersion,
  HandoffDetail,
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

export async function updateConsultation(consultationId: number, request: ConsultationUpdate, careSubjectId?: number) {
  const { data } = await api.patch<ConsultationDetail>(`/consultations/${consultationId}`, request, { careSubjectId })
  return data
}

export async function deleteConsultation(consultationId: number, careSubjectId?: number) {
  await api.delete(`/consultations/${consultationId}`, { careSubjectId })
}

/** Versiones declaradas después de la fecha de esa consulta. 404 si la consulta no existe. */
export async function listChangesSinceConsultation(careSubjectId: number, sinceConsultationId: number, signal?: AbortSignal) {
  const { data } = await api.get<HealthEntryVersion[]>(`${base(careSubjectId)}/changes`, {
    params: { sinceConsultationId },
    signal,
  })
  return data
}

export async function prepareConsultation(consultationId: number, signal?: AbortSignal, careSubjectId?: number) {
  const { data } = await api.get<ConsultationPreparation>(
    `/consultations/${consultationId}/preparation`, { signal, careSubjectId },
  )
  return data
}

export async function confirmConsultation(consultationId: number, body: ConfirmPreparation, careSubjectId?: number) {
  const { data } = await api.post<HandoffDetail>(
    `/consultations/${consultationId}/preparation/confirm`, body, { careSubjectId },
  )
  return data
}
