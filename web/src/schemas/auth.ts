import { z } from 'zod'
import { email, requiredText } from './common'

export const loginSchema = z.object({
  email: email(),
  password: z.string().min(1, 'Escribe tu contraseña.'),
})

export const registerSchema = z.object({
  name: requiredText('Escribe tu nombre.', 120),
  email: email(),
  password: z.string()
    .min(8, 'Escribe al menos 8 caracteres.')
    .max(72, 'Máximo 72 caracteres.')
    .regex(/[A-Za-z]/, 'Incluye al menos una letra de la A a la Z.')
    .regex(/[0-9]/, 'Incluye al menos un número.')
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      'La contraseña debe ocupar como máximo 72 bytes.',
    ),
})
