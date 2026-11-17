import { z } from 'zod'
import type { CareSubject, CareSubjectRequest } from '../types'
import { optionalDate, optionalGender, optionalText, requiredText } from './common'

/** Nueva / editar persona. POST y PATCH /care-subjects. */
export const careSubjectSchema = z.object({
  name: requiredText('Escribe el nombre.', 120),
  birthDate: optionalDate({ past: true }),
  gender: optionalGender(),
  notes: optionalText(500),
}) satisfies z.ZodType<CareSubjectRequest, unknown>

export type CareSubjectFormValues = z.input<typeof careSubjectSchema>
export const careSubjectFields = Object.keys(careSubjectSchema.shape) as (keyof CareSubjectFormValues)[]

export const emptyCareSubject: CareSubjectFormValues = { name: '', birthDate: '', gender: '', notes: '' }

export function careSubjectToForm(subject: CareSubject): CareSubjectFormValues {
  return { name: subject.name, birthDate: subject.birthDate ?? '', gender: subject.gender ?? '', notes: subject.notes ?? '' }
}
