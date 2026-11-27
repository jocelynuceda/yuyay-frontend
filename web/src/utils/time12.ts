export type Period = 'AM' | 'PM'

/** De lo escrito en 12 horas a 'HH:MM'. Si no es una hora, devuelve '?texto' para que la validación lo rechace. */
export function toTime(text: string, period: Period): string {
  const value = text.trim()
  if (!value) return ''
  const match = /^(\d{1,2})(?::?(\d{2}))?$/.exec(value)
  const hour = Number(match?.[1])
  const minute = Number(match?.[2] ?? 0)
  if (!match || hour < 1 || hour > 12 || minute > 59) return `?${value}`
  const hour24 = (hour % 12) + (period === 'PM' ? 12 : 0)
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/** De 'HH:MM[:SS]' a lo que se muestra en el campo. */
export function fromTime(time: string): { text: string; period: Period } {
  const match = /^(\d{2}):(\d{2})/.exec(time)
  if (!match) return { text: '', period: 'AM' }
  const hour = Number(match[1])
  return { text: `${hour % 12 || 12}:${match[2]}`, period: hour < 12 ? 'AM' : 'PM' }
}
