import { z } from 'zod'
import { CATEGORY_CODES, type DelegationRequest } from '../types'
import { email, isIsoDate, requiredText, todayIso } from './common'

/**
 * Último día que se puede elegir: la misma fecha un año después (AAAA-MM-DD), igual que en la app móvil.
 * Un 29 de febrero pasa al 28, porque el año siguiente no es bisiesto.
 */
export function maxDelegationDay(today = todayIso()) {
  const next = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`
  return next.endsWith('-02-29') ? next.replace(/-29$/, '-28') : next
}

/** Delegar acceso. `validUntil` viene de un <input type="date">. */
export const delegationSchema = z
  .object({
    granteeName: requiredText('Escribe el nombre de la persona.', 120),
    granteeEmail: email(),
    categoryCodes: z.array(z.enum(CATEGORY_CODES)),
    includeConsultations: z.boolean(),
    // Igual que en la app móvil: se elige el día y el acceso vale hasta el final de ese día, como máximo un año desde hoy
    validUntil: z
      .string()
      .min(1, 'Elige hasta cuándo.')
      .refine(isIsoDate, 'Fecha inválida.')
      .refine((v) => v >= todayIso(), 'La fecha no puede ser anterior a hoy.')
      .refine((v) => v <= maxDelegationDay(), 'Máximo un año desde hoy.')
      .transform((v) => new Date(`${v}T23:59:59`).toISOString()),
  })
  .refine((values) => values.categoryCodes.length > 0 || values.includeConsultations, {
    path: ['categoryCodes'],
    message: 'Elige al menos una categoría o las citas.',
  }) satisfies z.ZodType<DelegationRequest, unknown>

export type DelegationFormValues = z.input<typeof delegationSchema>
export const delegationFields = Object.keys(delegationSchema.shape) as (keyof DelegationFormValues)[]

export const emptyDelegation: DelegationFormValues = {
  granteeName: '',
  granteeEmail: '',
  categoryCodes: [],
  includeConsultations: false,
  validUntil: '',
}
