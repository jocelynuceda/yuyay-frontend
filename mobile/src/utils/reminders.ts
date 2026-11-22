import type { Consultation } from '../types';

/** El aviso local suena esta cantidad de minutos antes de la hora de la cita. */
export const REMINDER_MINUTES_BEFORE = 60;

/** Texto de la pantalla bloqueada: no dice el motivo, la persona ni nada clínico. */
export const REMINDER_CONTENT = {
  title: 'Yuyay',
  body: 'Tienes una cita en una hora. Abre Yuyay para ver los detalles.',
};

export type ReminderCitation = Pick<Consultation, 'id' | 'careSubjectId' | 'date' | 'time'>;

/** Lo que se guarda dentro del aviso programado para poder reconciliarlo luego. */
export interface ReminderData {
  kind: 'consultation-reminder';
  userId: number;
  consultationId: number;
  subjectId: number;
  date: string;
  time: string;
}

export interface ScheduledReminder {
  identifier: string;
  data: ReminderData;
}

/** Un identificador fijo por cuenta y cita: volver a programarlo reemplaza el anterior, sin duplicados. */
export const reminderId = (userId: number, consultationId: number) => `cita-${userId}-${consultationId}`;

export const reminderDataOf = (userId: number, c: ReminderCitation): ReminderData => ({
  kind: 'consultation-reminder',
  userId,
  consultationId: c.id,
  subjectId: c.careSubjectId,
  date: c.date,
  time: c.time ?? '',
});

export function isReminderData(value: unknown): value is ReminderData {
  const data = value as Partial<ReminderData> | null;
  return !!data && data.kind === 'consultation-reminder' && typeof data.consultationId === 'number';
}

/**
 * Cuándo debe sonar el aviso, en la hora del teléfono. Devuelve null si la cita no tiene hora
 * o si ese momento ya pasó (por ejemplo, falta menos de una hora).
 */
export function reminderFireDate(c: Pick<Consultation, 'date' | 'time'>, now: Date = new Date()): Date | null {
  if (!c.time) return null;
  const [year, month, day] = c.date.split('-').map(Number);
  const [hour, minute] = c.time.split(':').map(Number);
  const fire = new Date(year, month - 1, day, hour, minute - REMINDER_MINUTES_BEFORE);
  return fire.getTime() > now.getTime() ? fire : null;
}

/** La hora del backend llega como "15:30:00" o "15:30": se comparan solo horas y minutos. */
const sameTime = (a: string, b: string | null) => a.slice(0, 5) === (b ?? '').slice(0, 5);

export interface ReconcilePlan {
  cancel: string[];
  reschedule: ReminderCitation[];
}

/**
 * Compara los avisos programados en este dispositivo con las citas que acaban de llegar del servidor.
 * - `loaded`: citas por persona, solo de las listas que se pudieron leer (las demás no se tocan).
 * - `knownSubjects`: si se leyó la lista completa de personas, las que ya no están cancelan sus avisos.
 * Cancela avisos de otra cuenta, de citas borradas, sin hora o ya pasadas, y reprograma las que cambiaron.
 */
export function planReconcile(
  scheduled: ScheduledReminder[],
  loaded: Map<number, ReminderCitation[]>,
  userId: number,
  { knownSubjects, now = new Date() }: { knownSubjects?: Set<number>; now?: Date } = {},
): ReconcilePlan {
  const plan: ReconcilePlan = { cancel: [], reschedule: [] };
  for (const { identifier, data } of scheduled) {
    if (data.userId !== userId) {
      plan.cancel.push(identifier);
      continue;
    }
    const list = loaded.get(data.subjectId);
    if (!list) {
      if (knownSubjects && !knownSubjects.has(data.subjectId)) plan.cancel.push(identifier);
      continue;
    }
    const current = list.find((c) => c.id === data.consultationId);
    if (!current || !reminderFireDate(current, now)) {
      plan.cancel.push(identifier);
    } else if (current.date !== data.date || !sameTime(data.time, current.time)) {
      plan.reschedule.push(current);
    }
  }
  return plan;
}
