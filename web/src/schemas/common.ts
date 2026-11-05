import { z } from 'zod'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Fecha de hoy en hora local, 'YYYY-MM-DD'. */
export function todayIso(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

const tooLong = (max: number) => `Máximo ${max} caracteres.`

/** Texto obligatorio. `message` es lo que se muestra si está vacío. */
export const requiredText = (message: string, max?: number) => {
  const base = z.string().trim().min(1, message)
  return max ? base.max(max, tooLong(max)) : base
}

/** Texto opcional: '' se envía como null. */
export const optionalText = (max?: number) =>
  (max ? z.string().trim().max(max, tooLong(max)) : z.string().trim()).transform((v) => v || null)

/** Fecha obligatoria de un <input type="date">. */
export const requiredDate = (message = 'Elige una fecha.') =>
  z.string().trim().min(1, message).refine(isIsoDate, 'Fecha inválida.')

/** Fecha opcional de un <input type="date">; '' se envía como null. */
export const optionalDate = ({ past = false } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || isIsoDate(v), 'Fecha inválida.')
    .refine((v) => !past || v === '' || v < todayIso(), 'Debe ser una fecha pasada.')
    .transform((v) => v || null)

export const email = (message = 'Escribe un correo válido.') =>
  z.string().trim().min(1, 'Escribe un correo.').max(150, tooLong(150)).pipe(z.email(message))
