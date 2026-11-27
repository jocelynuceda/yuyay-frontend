import { z } from 'zod'
import { passwordError } from '../utils/password'
import { email, optionalGender, requiredText } from './common'

const newPassword = z.string().superRefine((value, ctx) => {
  const message = passwordError(value)
  if (message) ctx.addIssue({ code: 'custom', message })
})
const confirmPassword = z.string().min(1, 'Confirma tu contraseña.')
const MISMATCH = 'Las contraseñas no coinciden.'

export const loginSchema = z.object({
  email: email(),
  password: z.string().refine(
    (value) => value.trim().length > 0,
    'Ingresa tu contraseña.',
  ),
})

export const registrationIdentitySchema = z.object({
  name: requiredText('Elige un nombre de usuario.', 120),
  fullName: requiredText('Confirma tu nombre antes de continuar.', 200),
  dni: z.string().trim().regex(/^\d{8}$/, 'Ingresa los 8 dígitos de tu DNI.'),
})

export const registerSchema = registrationIdentitySchema
  .extend({
    gender: optionalGender(),
    email: email(),
    password: newPassword,
    confirmPassword,
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: MISMATCH })

export const forgotPasswordSchema = z.object({ email: email() })

export const resetPasswordSchema = z
  .object({
    code: z.string().regex(/^\d{6}$/, 'Ingresa los 6 dígitos.'),
    newPassword,
    confirmPassword,
  })
  .refine((values) => values.newPassword === values.confirmPassword, { path: ['confirmPassword'], message: MISMATCH })
