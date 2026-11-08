import { z } from 'zod'
import { requiredText } from './common'

export const profileSchema = z.object({
  name: requiredText('Escribe tu nombre.', 120),
})
