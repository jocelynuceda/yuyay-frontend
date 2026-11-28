import type { AgendaDose, DayOfWeek, DoseStatus, MedicationSchedule } from '../types'
import { formatDate, formatTime } from './format'

/** Lunes primero, como en el calendario peruano. */
export const WEEK_DAYS: { value: DayOfWeek; short: string; long: string }[] = [
  { value: 'MONDAY', short: 'Lu', long: 'lunes' },
  { value: 'TUESDAY', short: 'Ma', long: 'martes' },
  { value: 'WEDNESDAY', short: 'Mi', long: 'miércoles' },
  { value: 'THURSDAY', short: 'Ju', long: 'jueves' },
  { value: 'FRIDAY', short: 'Vi', long: 'viernes' },
  { value: 'SATURDAY', short: 'Sá', long: 'sábado' },
  { value: 'SUNDAY', short: 'Do', long: 'domingo' },
]

/**
 * Frecuencias comunes de una receta y las horas que se proponen. Son solo un punto de partida: la
 * persona las cambia según lo que diga su receta. Yuyay no decide la dosis ni el horario.
 */
export const FREQUENCY_PRESETS = [
  { id: 'once', label: '1 vez al día', times: ['08:00'] },
  { id: 'every12', label: 'Cada 12 h', times: ['08:00', '20:00'] },
  { id: 'every8', label: 'Cada 8 h', times: ['06:00', '14:00', '22:00'] },
  { id: 'every6', label: 'Cada 6 h', times: ['06:00', '12:00', '18:00', '00:00'] },
] as const

/** 'HH:mm:ss' o 'HH:mm' → 'HH:mm'. */
export const shortTime = (time: string) => time.slice(0, 5)

/** Fecha 'YYYY-MM-DD' más n días, sin pasar por UTC. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Lunes de la semana de esa fecha. */
export function startOfWeek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7
  return addDays(iso, -weekday)
}

export type PartOfDay = 'morning' | 'afternoon' | 'night'

export const PART_OF_DAY_LABELS: Record<PartOfDay, string> = {
  morning: 'Mañana',
  afternoon: 'Tarde',
  night: 'Noche',
}

/** Mañana hasta las 11:59, tarde hasta las 18:59; la noche incluye la madrugada. */
export function partOfDay(time: string): PartOfDay {
  const hour = Number(time.slice(0, 2))
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 19) return 'afternoon'
  return 'night'
}

export function groupByPartOfDay(doses: AgendaDose[]): { part: PartOfDay; doses: AgendaDose[] }[] {
  const order: PartOfDay[] = ['morning', 'afternoon', 'night']
  return order
    .map((part) => ({ part, doses: doses.filter((dose) => partOfDay(dose.time) === part) }))
    .filter((group) => group.doses.length > 0)
}

/** «Todos los días» o «lunes, miércoles y viernes». */
export function describeDays(days: DayOfWeek[]): string {
  if (days.length === 0 || days.length === 7) return 'Todos los días'
  const names = WEEK_DAYS.filter((day) => days.includes(day.value)).map((day) => day.long)
  const text = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0]
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Resumen de una línea: «8:00 a. m. y 8:00 p. m. · Todos los días · hasta el 5 de diciembre de 2026». */
export function describeSchedule(schedule: Pick<MedicationSchedule, 'times' | 'daysOfWeek' | 'endDate'>): string {
  const times = schedule.times.map(formatTime)
  const timesText = times.length > 1 ? `${times.slice(0, -1).join(', ')} y ${times.at(-1)}` : times[0]
  const end = schedule.endDate ? `hasta el ${formatDate(schedule.endDate)}` : 'sin fecha de fin'
  return `${timesText} · ${describeDays(schedule.daysOfWeek)} · ${end}`
}

/** Una toma se marca desde 2 h antes de su hora y, a tiempo, hasta 30 min después (la regla del backend). */
/**
 * Las horas de las tomas son hora de Lima, la misma zona con la que el servidor calcula los plazos
 * (app.reminders.zone). Perú no usa horario de verano: es UTC−5 todo el año. Así una computadora en
 * otra zona horaria muestra los mismos plazos que el servidor.
 */
export const LIMA_OFFSET_MINUTES = -5 * 60

/** Instante (ms) de una fecha 'YYYY-MM-DD' y una hora 'HH:mm' de Lima. */
export function limaInstant(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5))) - LIMA_OFFSET_MINUTES * 60_000
}

/** Fecha de hoy en Lima, sea cual sea la zona de la computadora. */
export function todayInLima(now: Date = new Date()): string {
  const lima = new Date(now.getTime() + LIMA_OFFSET_MINUTES * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${lima.getUTCFullYear()}-${pad(lima.getUTCMonth() + 1)}-${pad(lima.getUTCDate())}`
}

export const MARK_BEFORE_MINUTES = 120
export const MARK_AFTER_MINUTES = 30

/**
 * Estado de una toma según la hora actual:
 * - `marked`: alguien la marcó.
 * - `upcoming`: faltan más de 2 horas (o es de otro día): todavía no se puede marcar.
 * - `due`: desde 2 h antes hasta 30 min después: se marca como tomada.
 * - `missed`: pasaron más de 30 min sin marcar: cuenta como no tomada; solo se puede marcar «se tomó tarde».
 */
export type DoseState = 'marked' | 'upcoming' | 'due' | 'missed'

export function doseState(dose: Pick<AgendaDose, 'date' | 'time' | 'status'>, now: Date = new Date()): DoseState {
  if (dose.status) return 'marked'
  // Al milisegundo, como el servidor: a las 8:30:01 una toma de las 8:00 ya es «se tomó tarde»
  const untilDose = limaInstant(dose.date, dose.time) - now.getTime()
  if (untilDose > MARK_BEFORE_MINUTES * 60_000) return 'upcoming'
  return -untilDose > MARK_AFTER_MINUTES * 60_000 ? 'missed' : 'due'
}

/** ¿Se tomó? A tiempo o tarde. Sin marcar y pasado el plazo, cuenta como no tomada. */
/** Lo que se marca al tocar «Tomada»: a tiempo o, pasado el plazo, «se tomó tarde». */
export const takenStatusFor = (dose: Pick<AgendaDose, 'date' | 'time'>, now: Date = new Date()): DoseStatus =>
  doseState({ ...dose, status: null }, now) === 'missed' ? 'LATE' : 'TAKEN'

/**
 * Lo que se envía al tocar un botón, calculado con la hora del momento del toque: si la pantalla quedó
 * abierta y pasó el plazo, «Tomada» se envía como «se tomó tarde», como exige el servidor.
 */
export const statusToSend = (dose: Pick<AgendaDose, 'date' | 'time'>, chosen: DoseStatus, now: Date = new Date()): DoseStatus =>
  chosen === 'SKIPPED' ? chosen : takenStatusFor(dose, now)

export const isTaken = (dose: Pick<AgendaDose, 'status'>) => dose.status === 'TAKEN' || dose.status === 'LATE'
