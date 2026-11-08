import { z } from 'zod'
import { email, requiredText } from './common'

export const loginSchema = z.object({
  email: email(),
  password: z.string()
    .min(8, 'Escribe al menos 8 caracteres.')
    .max(72, 'Máximo 72 caracteres.')
    .regex(/\p{L}/u, 'Incluye al menos una letra.')
    .regex(/[0-9]/, 'Incluye al menos un número.'),
})

export const registerSchema = loginSchema.extend({
  name: requiredText('Escribe tu nombre.', 120),
})
