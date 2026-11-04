import { z } from 'zod'
import type { CareInviteRequest } from '../types'
import { email, optionalText } from './common'

/** Invitar cuidador. POST /care-subjects/{id}/relationships. */
export const caregiverInviteSchema = z.object({
  email: email(),
  role: z.enum(['PRINCIPAL', 'CAREGIVER'], 'Elige un rol.'),
  relationshipLabel: optionalText(60),
}) satisfies z.ZodType<CareInviteRequest, unknown>

export type CaregiverInviteFormValues = z.input<typeof caregiverInviteSchema>
export const caregiverInviteFields = Object.keys(caregiverInviteSchema.shape) as (keyof CaregiverInviteFormValues)[]

export const emptyCaregiverInvite: CaregiverInviteFormValues = { email: '', role: 'CAREGIVER', relationshipLabel: '' }
