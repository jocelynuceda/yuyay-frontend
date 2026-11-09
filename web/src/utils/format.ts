import type { CategoryCode, ConfidenceLevel } from '../types'

const dateFormatter = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Las fechas LocalDate ('2024-05-01') se leen en hora local para no correrse un día. */
function parse(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}

export const formatDate = (value?: string | null) => (value ? dateFormatter.format(parse(value)) : '—')

export const formatDateTime = (value?: string | null) => (value ? dateTimeFormatter.format(parse(value)) : '—')

/** Nombres de las categorías del backend (DataSeeder). */
export const categoryLabels: Record<CategoryCode, { name: string; plural: string }> = {
  ALLERGY: { name: 'Alergia', plural: 'Alergias' },
  CONDITION: { name: 'Condición', plural: 'Condiciones' },
  MEDICATION: { name: 'Medicación', plural: 'Medicación' },
  IMMUNIZATION: { name: 'Vacuna', plural: 'Vacunas' },
  EPISODE: { name: 'Episodio', plural: 'Episodios' },
}

export const confidenceLabels: Record<ConfidenceLevel, string> = {
  CONFIRMED: 'Confirmado',
  UNCERTAIN: 'Por confirmar',
}

/** Edad en años cumplidos a partir de la fecha de nacimiento, o null si no hay. */
export function ageFrom(birthDate?: string | null): number | null {
  if (!birthDate) return null
  const birth = parse(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age--
  return age
}

const weekdayDateFormatter = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })
const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const DAY_MS = 86_400_000

/** Fecha con día de la semana: "jueves, 12 de noviembre". */
export const formatWeekdayDate = (value?: string | null) => (value ? weekdayDateFormatter.format(parse(value)) : '—')

/** Días enteros desde hoy (hora local) hasta la fecha; negativo si ya pasó. */
export function daysUntil(value: string, now = new Date()): number {
  const target = parse(value)
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const to = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((to.getTime() - from.getTime()) / DAY_MS)
}

/** "hoy", "mañana" o "en N días". */
export function describeDaysUntil(days: number): string {
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days} días`
}

/** "hace 5 minutos", "ayer"; a partir de una semana, la fecha completa. */
export function formatRelative(value: string, now = new Date()): string {
  const diffMs = parse(value).getTime() - now.getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (Math.abs(minutes) < 1) return 'justo ahora'
  if (Math.abs(minutes) < 60) return relativeFormatter.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return relativeFormatter.format(hours, 'hour')
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 7) return relativeFormatter.format(days, 'day')
  return formatDate(value)
}

export const careRoleLabels: Record<string, string> = {
  PRINCIPAL: 'Principal',
  CAREGIVER: 'Cuidador',
}

export const userRoleLabels: Record<string, string> = {
  USER: 'Usuario',
  ADMIN: 'Administrador',
}

export const notificationTypeLabels: Record<string, string> = {
  ENTRY_CHANGED: 'Cambio en un registro',
  INVITATION: 'Invitación',
  CAREGIVER_JOINED: 'Nuevo cuidador',
}
