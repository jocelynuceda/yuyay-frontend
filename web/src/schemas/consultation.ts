import { z } from 'zod'
import type { Consultation, ConsultationRequest, ConsultationUpdate } from '../types'
import { optionalText, requiredDate, requiredText, todayIso } from './common'

const TIME = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

/** Nueva consulta o edición. Acepta fechas pasadas, de hoy y futuras. La hora es opcional. */
export const consultationSchema = z.object({
  date: requiredDate(),
  time: z
    .string()
    .trim()
    .refine((value) => !value || TIME.test(value), 'Hora inválida.')
    .transform((value) => value || null),
  reason: requiredText('Escribe el motivo de la consulta.', 200),
  notes: optionalText(),
}) satisfies z.ZodType<ConsultationRequest, unknown>

export type ConsultationFormValues = z.input<typeof consultationSchema>
export type ConsultationFormOutput = z.output<typeof consultationSchema>
export const consultationFields = Object.keys(consultationSchema.shape) as (keyof ConsultationFormValues)[]

export const emptyConsultation = (): ConsultationFormValues => ({ date: todayIso(), time: '', reason: '', notes: '' })

export function consultationToForm(c: Consultation): ConsultationFormValues {
  return { date: c.date, time: c.time?.slice(0, 5) ?? '', reason: c.reason, notes: c.notes ?? '' }
}

/** En PATCH lo ausente no cambia: sin hora se pide quitarla y las notas vacías se envían como ''. */
export function toConsultationUpdate(values: ConsultationFormOutput): ConsultationUpdate {
  const { date, time, reason, notes } = values
  return { date, ...(time ? { time } : {}), clearTime: !time, reason, notes: notes ?? '' }
}
