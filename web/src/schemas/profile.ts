import { z } from 'zod'
import { optionalDate, optionalGender, requiredText } from './common'

export const profileSchema = z.object({
  name: requiredText('Escribe tu nombre.', 120),
  gender: optionalGender(),
  birthDate: optionalDate({ past: true }),
})
