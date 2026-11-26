import { z } from 'zod'
import { CATEGORY_CODES } from '../types'
import { defaultDelegationDuration, delegationExpiry } from '../utils/accessDurations'
import { email, requiredText } from './common'
import { durationSchema } from './duration'

/** La vigencia se ancla al envío para que el usuario reciba la duración elegida. */
export const delegationSchema = z
  .object({
    granteeName: requiredText('Introduce tu nombre', 120),
    granteeEmail: email(),
    categoryCodes: z.array(z.enum(CATEGORY_CODES)),
    includeConsultations: z.boolean(),
    duration: durationSchema.superRefine((value, ctx) => {
      const { error } = delegationExpiry(value)
      if (error) ctx.addIssue({ code: 'custom', path: ['amount'], message: error })
    }),
  })
  .refine((values) => values.categoryCodes.length > 0 || values.includeConsultations, {
    path: ['categoryCodes'],
    message: 'Elige al menos una categoría o las citas.',
  })

export type DelegationFormValues = z.input<typeof delegationSchema>
export const delegationFields = Object.keys(delegationSchema.shape) as (keyof DelegationFormValues)[]

export const emptyDelegation: DelegationFormValues = {
  granteeName: '',
  granteeEmail: '',
  categoryCodes: [],
  includeConsultations: false,
  duration: defaultDelegationDuration,
}
