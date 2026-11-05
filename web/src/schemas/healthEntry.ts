import { z } from 'zod'
import {
  CATEGORY_CODES,
  MEDICATION,
  type HealthEntry,
  type HealthEntryCreateRequest,
  type HealthEntryUpdateRequest,
} from '../types'
import { optionalDate, optionalText, requiredText } from './common'

/**
 * Nuevo / editar registro. Al editar la categoría no se puede cambiar
 * (usar `toUpdateRequest`), pero se mantiene en el formulario para la regla de dosis.
 */
export const healthEntrySchema = z
  .object({
    categoryCode: z.enum(CATEGORY_CODES, 'Elige una categoría.'),
    title: requiredText('Escribe un título.', 150),
    details: optionalText(),
    dose: optionalText(60),
    frequency: optionalText(60),
    occurredOn: optionalDate(),
    confidenceLevel: z.enum(['CONFIRMED', 'UNCERTAIN'], 'Indica qué tan seguro es el dato.'),
    notes: optionalText(),
  })
  .superRefine((values, ctx) => {
    if (values.categoryCode === MEDICATION) return
    // El backend responde 400 si se envía dosis o frecuencia fuera de medicación.
    for (const field of ['dose', 'frequency'] as const) {
      if (values[field]) ctx.addIssue({ code: 'custom', path: [field], message: 'Solo aplica a medicación.' })
    }
  }) satisfies z.ZodType<HealthEntryCreateRequest, unknown>

export type HealthEntryFormValues = z.input<typeof healthEntrySchema>
export type HealthEntryFormOutput = z.output<typeof healthEntrySchema>
export const healthEntryFields = Object.keys(healthEntrySchema.shape) as (keyof HealthEntryFormValues)[]

export const emptyHealthEntry: HealthEntryFormValues = {
  categoryCode: 'ALLERGY',
  title: '',
  details: '',
  dose: '',
  frequency: '',
  occurredOn: '',
  confidenceLevel: 'CONFIRMED',
  notes: '',
}

export function healthEntryToForm(entry: HealthEntry): HealthEntryFormValues {
  const v = entry.latestVersion
  return {
    categoryCode: entry.categoryCode,
    title: v.title,
    details: v.details ?? '',
    dose: v.dose ?? '',
    frequency: v.frequency ?? '',
    occurredOn: v.occurredOn ?? '',
    confidenceLevel: v.confidenceLevel,
    notes: v.notes ?? '',
  }
}

/** PATCH no acepta categoryCode. */
export function toUpdateRequest(values: HealthEntryFormOutput): HealthEntryUpdateRequest {
  const { title, details, dose, frequency, occurredOn, confidenceLevel, notes } = values
  return { title, details, dose, frequency, occurredOn, confidenceLevel, notes }
}
