import { z } from 'zod'
import { CATEGORY_CODES, type DelegationRequest } from '../types'
import { email, requiredText } from './common'

/** Delegar acceso. `validUntil` viene de un <input type="datetime-local"> (hora local). */
export const delegationSchema = z
  .object({
    granteeName: requiredText('Escribe el nombre de la persona.', 120),
    granteeEmail: email(),
    categoryCodes: z.array(z.enum(CATEGORY_CODES)),
    includeConsultations: z.boolean(),
    validUntil: z
      .string()
      .min(1, 'Elige hasta cuándo es válido.')
      .refine((v) => !Number.isNaN(new Date(v).getTime()), 'Fecha inválida.')
      .refine((v) => new Date(v).getTime() > Date.now(), 'Debe ser una fecha futura.')
      .transform((v) => new Date(v).toISOString()),
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
