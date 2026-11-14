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

/** Último día que cuenta como fecha pasada, 'YYYY-MM-DD'. */
export function yesterdayIso(): string {
  const now = new Date()
  now.setDate(now.getDate() - 1)
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

/** Mismas reglas de fechas que la app móvil (mobile/src/utils/dates.ts). */
export const MIN_YEAR = 1900
const yearOf = (value: string) => Number(value.slice(0, 4))
const minYear = (v: string) => v === '' || yearOf(v) >= MIN_YEAR
const minYearMessage = `El año debe ser ${MIN_YEAR} o posterior.`
/** Último año permitido para fechas futuras (por ejemplo, citas hasta dentro de 2 años). */
export const maxYear = (yearsAhead: number) => new Date().getFullYear() + yearsAhead

const tooLong = (max: number) => `Máximo ${max} caracteres.`

/** Texto obligatorio. `message` es lo que se muestra si está vacío. */
export const requiredText = (message: string, max?: number) => {
  const base = z.string().trim().min(1, message)
  return max ? base.max(max, tooLong(max)) : base
}

/** Texto opcional: '' se envía como null. */
export const optionalText = (max?: number) =>
  (max ? z.string().trim().max(max, tooLong(max)) : z.string().trim()).transform((v) => v || null)

/** Fecha obligatoria de un <input type="date">. Con `maxYearsAhead`, acepta fechas futuras hasta ese año. */
export const requiredDate = (message = 'Elige una fecha.', { maxYearsAhead }: { maxYearsAhead?: number } = {}) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine(isIsoDate, 'Fecha inválida.')
    .refine(minYear, minYearMessage)
    .refine(
      (v) => maxYearsAhead === undefined || yearOf(v) <= maxYear(maxYearsAhead),
      `El año debe ser ${maxYear(maxYearsAhead ?? 0)} o anterior.`,
    )

/**
 * Fecha opcional de un <input type="date">; '' se envía como null.
 * `past`: anterior a hoy (nacimiento). `notFuture`: hoy o antes (un registro de algo que ya pasó).
 */
export const optionalDate = ({ past = false, notFuture = false } = {}) =>
  z
    .string()
    .trim()
    .refine((v) => v === '' || isIsoDate(v), 'Fecha inválida.')
    .refine(minYear, minYearMessage)
    .refine((v) => !past || v === '' || v < todayIso(), 'La fecha debe ser anterior a hoy.')
    .refine((v) => !notFuture || v === '' || v <= todayIso(), 'La fecha no puede ser futura.')
    .transform((v) => v || null)

export const email = (message = 'Escribe un correo válido.') =>
  z.string().trim().min(1, 'Escribe un correo.').max(150, tooLong(150)).pipe(z.email(message))
