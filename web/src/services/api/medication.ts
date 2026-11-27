import { api } from '../http'
import type { AgendaDose, DoseStatus, MedicationSchedule, MedicationScheduleRequest } from '../../types'

const scheduleUrl = (careSubjectId: number, entryId: number) =>
  `/care-subjects/${careSubjectId}/health-entries/${entryId}/schedule`

/** Horario del medicamento, o null si todavía no tiene. */
export async function getMedicationSchedule(careSubjectId: number, entryId: number, signal?: AbortSignal) {
  try {
    const { data } = await api.get<MedicationSchedule>(scheduleUrl(careSubjectId, entryId), { signal })
    return data
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status === 404) return null
    throw error
  }
}

export async function saveMedicationSchedule(careSubjectId: number, entryId: number, request: MedicationScheduleRequest) {
  const { data } = await api.put<MedicationSchedule>(scheduleUrl(careSubjectId, entryId), request)
  return data
}

export async function deleteMedicationSchedule(careSubjectId: number, entryId: number) {
  await api.delete(scheduleUrl(careSubjectId, entryId))
}

/** Tomas de todas las personas que cuido entre dos fechas (máximo 42 días). */
export async function getMedicationAgenda(from: string, to: string, signal?: AbortSignal) {
  const { data } = await api.get<AgendaDose[]>('/me/medication-agenda', { params: { from, to }, signal })
  return data
}

export async function markDose(scheduleId: number, request: { date: string; time: string; status: DoseStatus }) {
  const { data } = await api.put<AgendaDose>(`/medication-schedules/${scheduleId}/doses`, request)
  return data
}

export async function unmarkDose(scheduleId: number, date: string, time: string) {
  await api.delete(`/medication-schedules/${scheduleId}/doses`, { params: { date, time } })
}
