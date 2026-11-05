import { z } from 'zod'
import type { Consultation, ConsultationRequest } from '../types'
import { optionalText, requiredDate, requiredText, todayIso } from './common'

/** Nueva consulta. Acepta fechas pasadas, de hoy y futuras. */
export const consultationSchema = z.object({
  date: requiredDate(),
  reason: requiredText('Escribe el motivo de la consulta.', 200),
  notes: optionalText(),
}) satisfies z.ZodType<ConsultationRequest, unknown>

export type ConsultationFormValues = z.input<typeof consultationSchema>
export const consultationFields = Object.keys(consultationSchema.shape) as (keyof ConsultationFormValues)[]

export const emptyConsultation = (): ConsultationFormValues => ({ date: todayIso(), reason: '', notes: '' })

export function consultationToForm(c: Consultation): ConsultationFormValues {
  return { date: c.date, reason: c.reason, notes: c.notes ?? '' }
}
