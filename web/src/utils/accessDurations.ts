export const durationUnits = ['minutes', 'hours', 'days'] as const

export type DurationUnit = (typeof durationUnits)[number]
export type Duration = { amount: string; unit: DurationUnit }

export const durationUnitLabels: Record<DurationUnit, string> = {
  minutes: 'Minutos',
  hours: 'Horas',
  days: 'Días',
}

export const defaultHandoffExpiry: Duration = { amount: '24', unit: 'hours' }
export const defaultHandoffReading: Duration = { amount: '30', unit: 'minutes' }
export const defaultDelegationDuration: Duration = { amount: '', unit: 'days' }

const minutesPerUnit: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 1440 }
const maxHandoffMinutes = 3 * minutesPerUnit.days
const minuteMs = 60_000
function durationError(amount: string) {
  if (!amount.trim()) return 'Introduce una cantidad.'
  if (amount.startsWith('-') || Number(amount) === 0) return 'Solo se aceptan números positivos'
  return 'Introduce un número entero.'
}

export function durationInMinutes({ amount, unit }: Duration) {
  if (!/^\d+$/.test(amount)) return null
  const minutes = Number(amount) * minutesPerUnit[unit]
  return Number.isSafeInteger(minutes) && minutes > 0 ? minutes : null
}

export function handoffDurations(expiry: Duration, reading: Duration) {
  const expiresInMinutes = durationInMinutes(expiry)
  const sessionWindowMinutes = durationInMinutes(reading)
  const expiryError = expiresInMinutes === null ? durationError(expiry.amount) :
    expiresInMinutes > maxHandoffMinutes ? 'El límite máximo es 3 días.' : undefined
  const readingError = sessionWindowMinutes === null ? durationError(reading.amount) :
    sessionWindowMinutes > maxHandoffMinutes ? 'El límite máximo es 3 días.' :
      !expiryError && expiresInMinutes !== null && sessionWindowMinutes > expiresInMinutes
        ? 'El tiempo de lectura no puede superar la vigencia del enlace.' : undefined

  if (expiresInMinutes === null || sessionWindowMinutes === null || expiryError || readingError) {
    return { errors: { expiry: expiryError, reading: readingError } } as const
  }
  return { request: { expiresInMinutes, sessionWindowMinutes } } as const
}

export function delegationExpiry(duration: Duration, now = new Date()) {
  const minutes = durationInMinutes(duration)
  if (minutes === null) return { error: durationError(duration.amount) } as const
  if (minutes > 365 * minutesPerUnit.days) return { error: 'El límite máximo es 365 días.' } as const
  return { validUntil: new Date(now.getTime() + minutes * minuteMs).toISOString() } as const
}
