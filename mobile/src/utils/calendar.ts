import type { Consultation } from '../types';

/** Duración con la que se crea la cita en Google Calendar; ahí se puede cambiar antes de guardarla. */
export const APPOINTMENT_MINUTES = 60;

export type CalendarTime = { hour: number; minute: number };
export type TimeParts = { hour: string; minute: string; period: 'am' | 'pm' };

export const TIME_ERROR = 'Revisa la hora: de 1 a 12 y minutos de 00 a 59.';

const pad = (value: number) => String(value).padStart(2, '0');
const compactDate = (date: Date) => `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
const compactDateTime = (date: Date) =>
  `${compactDate(date)}T${pad(date.getHours())}${pad(date.getMinutes())}00`;

/** Convierte hora, minutos y a. m./p. m. a 24 horas. Devuelve null si la hora no existe. */
export function parseTime({ hour, minute, period }: TimeParts): CalendarTime | null {
  const h = Number(hour);
  const m = minute ? Number(minute) : 0;
  if (!hour || !Number.isInteger(h) || !Number.isInteger(m) || h < 1 || h > 12 || m < 0 || m > 59) return null;
  return { hour: (h % 12) + (period === 'pm' ? 12 : 0), minute: m };
}

/** Lee la hora del backend ("15:30:00"). */
export function savedTime(value: string): CalendarTime {
  const [hour, minute] = value.split(':').map(Number);
  return { hour, minute };
}

/** La hora guardada, repartida en las casillas de TimeField. */
export function timePartsOf(value: string): TimeParts {
  const { hour, minute } = savedTime(value);
  return { hour: String(hour % 12 || 12), minute: pad(minute), period: hour < 12 ? 'am' : 'pm' };
}

export const toApiTime = ({ hour, minute }: CalendarTime) => `${pad(hour)}:${pad(minute)}`;

/**
 * Enlace que abre Google Calendar con el evento ya lleno; la persona solo confirma con su cuenta.
 * Con hora, el evento dura APPOINTMENT_MINUTES. Sin hora es de todo el día (Google pide el fin como día siguiente).
 */
export function googleCalendarUrl(
  consultation: Pick<Consultation, 'date' | 'reason' | 'notes'>,
  subjectName: string,
  time?: CalendarTime,
) {
  const [year, month, day] = consultation.date.split('-').map(Number);
  const dates = time
    ? [
        new Date(year, month - 1, day, time.hour, time.minute),
        new Date(year, month - 1, day, time.hour, time.minute + APPOINTMENT_MINUTES),
      ]
        .map(compactDateTime)
        .join('/')
    : `${compactDate(new Date(year, month - 1, day))}/${compactDate(new Date(year, month - 1, day + 1))}`;
  const params = [
    ['action', 'TEMPLATE'],
    ['text', `Cita de ${subjectName}: ${consultation.reason}`],
    ['dates', dates],
    ['details', consultation.notes ?? ''],
    // La hora escrita es la del teléfono, aunque la cuenta de Google tenga otra zona
    ...(time ? [['ctz', Intl.DateTimeFormat().resolvedOptions().timeZone]] : []),
  ];
  const query = params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `https://calendar.google.com/calendar/render?${query}`;
}
