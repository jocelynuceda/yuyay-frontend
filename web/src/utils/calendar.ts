import type { Consultation } from '../types'

export const APPOINTMENT_MINUTES = 60

const DAY_MS = 86_400_000
const compact = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '')

/** Prepara un evento para revisar en Google Calendar con la fecha y la hora local de la consulta. */
export function googleCalendarUrl(
  { date, reason, time }: Pick<Consultation, 'date' | 'reason' | 'time'>,
  subjectName: string,
) {
  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', `Cita de ${subjectName}: ${reason}`)

  if (time) {
    // El navegador interpreta la hora como local. Usamos instantes para conservar la duración al cambiar el horario.
    const start = new Date(`${date}T${time.slice(0, 5)}:00`)
    const end = new Date(start.getTime() + APPOINTMENT_MINUTES * 60_000)
    url.searchParams.set('dates', `${compact(start)}/${compact(end)}`)
    url.searchParams.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone)
  } else {
    // Google usa un fin exclusivo en los eventos de todo el día.
    const start = new Date(`${date}T00:00:00Z`)
    const end = new Date(start.getTime() + DAY_MS)
    url.searchParams.set('dates', `${compact(start).slice(0, 8)}/${compact(end).slice(0, 8)}`)
  }

  return url.href
}
