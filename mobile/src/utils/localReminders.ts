import type { Consultation } from '../types';

/** El aviso local suena 1 hora antes; el del servidor (backend #71) llega el día anterior a las 18:00. */
export const LOCAL_REMINDER_LEAD_MINUTES = 60;

/** Texto discreto para la pantalla bloqueada: sin nombre ni motivo. */
export const LOCAL_REMINDER_TITLE = 'Yuyay';
export const LOCAL_REMINDER_BODY = 'Tienes una cita en 1 hora.';

/** Un aviso programado en este celular para una cita de la cuenta. */
export interface StoredReminder {
  consultationId: number;
  subjectId: number;
  notificationId: string;
  /** Momento programado (ISO). Si la cita cambia de hora, deja de coincidir y se reprograma. */
  triggerAt: string;
}

type AppointmentTime = Pick<Consultation, 'date' | 'time'>;

/**
 * Cuándo debe sonar el aviso de una cita, en la hora local del celular. null si la cita no tiene
 * hora o si ese momento ya pasó: entonces no se puede activar.
 */
export function reminderTriggerDate(
  consultation: AppointmentTime,
  now: Date = new Date(),
  leadMinutes = LOCAL_REMINDER_LEAD_MINUTES,
): Date | null {
  if (!consultation.time) return null;
  const [year, month, day] = consultation.date.split('-').map(Number);
  const [hour, minute] = consultation.time.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => !Number.isFinite(n))) return null;
  const trigger = new Date(year, month - 1, day, hour, minute - leadMinutes);
  return trigger.getTime() > now.getTime() ? trigger : null;
}

export type ReconcileAction =
  | { kind: 'cancel'; reminder: StoredReminder }
  | { kind: 'reschedule'; reminder: StoredReminder; consultation: Consultation; trigger: Date };

/**
 * Compara los avisos guardados de una persona con sus citas actuales: la cita borrada, sin hora o ya
 * pasada se cancela; la que cambió de fecha u hora se reprograma. Así no quedan avisos duplicados.
 */
export function reconcileSubject(
  stored: readonly StoredReminder[],
  subjectId: number,
  consultations: readonly Consultation[],
  now: Date = new Date(),
): ReconcileAction[] {
  const actions: ReconcileAction[] = [];
  for (const reminder of stored) {
    if (reminder.subjectId !== subjectId) continue;
    const consultation = consultations.find((c) => c.id === reminder.consultationId);
    const trigger = consultation ? reminderTriggerDate(consultation, now) : null;
    if (!consultation || !trigger) actions.push({ kind: 'cancel', reminder });
    else if (trigger.toISOString() !== reminder.triggerAt) actions.push({ kind: 'reschedule', reminder, consultation, trigger });
  }
  return actions;
}

/** Avisos de personas a las que la cuenta ya no tiene acceso. */
export function remindersWithoutAccess(stored: readonly StoredReminder[], subjectIds: readonly number[]): StoredReminder[] {
  const allowed = new Set(subjectIds);
  return stored.filter((reminder) => !allowed.has(reminder.subjectId));
}
