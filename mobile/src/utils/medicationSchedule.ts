import type { AgendaDose, DayOfWeek, DoseStatus } from '../types';

/** Lunes primero, como en el calendario peruano. Mismas reglas que la web (web/src/utils/medicationSchedule.ts). */
export const WEEK_DAYS: { value: DayOfWeek; short: string; long: string }[] = [
  { value: 'MONDAY', short: 'Lu', long: 'lunes' },
  { value: 'TUESDAY', short: 'Ma', long: 'martes' },
  { value: 'WEDNESDAY', short: 'Mi', long: 'miércoles' },
  { value: 'THURSDAY', short: 'Ju', long: 'jueves' },
  { value: 'FRIDAY', short: 'Vi', long: 'viernes' },
  { value: 'SATURDAY', short: 'Sá', long: 'sábado' },
  { value: 'SUNDAY', short: 'Do', long: 'domingo' },
];

/** Frecuencias comunes y las horas que se proponen; la persona las cambia según su receta. */
export const FREQUENCY_PRESETS = [
  { id: 'once', label: '1 vez al día', times: ['08:00'] },
  { id: 'every12', label: 'Cada 12 h', times: ['08:00', '20:00'] },
  { id: 'every8', label: 'Cada 8 h', times: ['06:00', '14:00', '22:00'] },
  { id: 'every6', label: 'Cada 6 h', times: ['00:00', '06:00', '12:00', '18:00'] },
] as const;

export const STATUS_LABELS: Record<DoseStatus, string> = { TAKEN: 'Tomada', LATE: 'Tomada tarde', SKIPPED: 'No tomada' };

/** 'HH:mm:ss' o 'HH:mm' → 'HH:mm'. */
export const shortTime = (time: string) => time.slice(0, 5);

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha 'YYYY-MM-DD' de un Date, en la hora del teléfono. */
export const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** 'HH:mm' de un Date, en la hora del teléfono. */
export const clockTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Fecha 'YYYY-MM-DD' más n días, sin pasar por UTC. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

/** Lunes de la semana de esa fecha. */
export function startOfWeek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return addDays(iso, -((new Date(y, m - 1, d).getDay() + 6) % 7));
}

/**
 * Las horas de las tomas son hora de Lima, la misma zona con la que el servidor calcula los plazos
 * (app.reminders.zone). Perú no usa horario de verano: es UTC−5 todo el año. Así un teléfono en otra
 * zona horaria muestra y avisa las tomas igual que el servidor.
 */
export const LIMA_OFFSET_MINUTES = -5 * 60;

/** Instante (ms) de una fecha 'YYYY-MM-DD' y una hora 'HH:mm' de Lima. */
export function limaInstant(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d, Number(time.slice(0, 2)), Number(time.slice(3, 5))) - LIMA_OFFSET_MINUTES * 60_000;
}

/** Fecha de hoy en Lima, sea cual sea la zona del teléfono. */
export function todayInLima(now: Date = new Date()): string {
  const lima = new Date(now.getTime() + LIMA_OFFSET_MINUTES * 60_000);
  return `${lima.getUTCFullYear()}-${pad(lima.getUTCMonth() + 1)}-${pad(lima.getUTCDate())}`;
}

/** Momento de una toma (su hora es hora de Lima). */
export function doseDate(dose: Pick<AgendaDose, 'date' | 'time'>): Date {
  return new Date(limaInstant(dose.date, dose.time));
}

export type PartOfDay = 'morning' | 'afternoon' | 'night';

export const PART_OF_DAY_LABELS: Record<PartOfDay, string> = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' };

/** Mañana hasta las 11:59, tarde hasta las 18:59; la noche incluye la madrugada. */
export function partOfDay(time: string): PartOfDay {
  const hour = Number(time.slice(0, 2));
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 19) return 'afternoon';
  return 'night';
}

export function groupByPartOfDay(doses: AgendaDose[]) {
  return (['morning', 'afternoon', 'night'] as PartOfDay[])
    .map((part) => ({ part, doses: doses.filter((dose) => partOfDay(dose.time) === part) }))
    .filter((group) => group.doses.length > 0);
}

/** «Todos los días» o «Lunes y jueves». */
export function describeDays(days: DayOfWeek[]): string {
  if (days.length === 0 || days.length === 7) return 'Todos los días';
  const names = WEEK_DAYS.filter((day) => days.includes(day.value)).map((day) => day.long);
  const text = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Una toma se marca desde 2 h antes y, a tiempo, hasta 30 min después (la regla del backend). */
export const MARK_BEFORE_MINUTES = 120;
export const MARK_AFTER_MINUTES = 30;

/**
 * - `marked`: alguien la marcó.
 * - `upcoming`: faltan más de 2 horas (o es de otro día): todavía no se puede marcar.
 * - `due`: desde 2 h antes hasta 30 min después: se marca como tomada.
 * - `missed`: pasaron más de 30 min sin marcar: cuenta como no tomada; solo «se tomó tarde».
 */
export type DoseState = 'marked' | 'upcoming' | 'due' | 'missed';

export function doseState(dose: Pick<AgendaDose, 'date' | 'time' | 'status'>, now: Date = new Date()): DoseState {
  if (dose.status) return 'marked';
  // Al milisegundo, como el servidor: a las 8:30:01 una toma de las 8:00 ya es «se tomó tarde»
  const untilDose = doseDate(dose).getTime() - now.getTime();
  if (untilDose > MARK_BEFORE_MINUTES * 60_000) return 'upcoming';
  return -untilDose > MARK_AFTER_MINUTES * 60_000 ? 'missed' : 'due';
}

/** Lo que se marca al tocar «Tomada»: a tiempo o, pasado el plazo, «se tomó tarde». */
export const takenStatusFor = (dose: Pick<AgendaDose, 'date' | 'time'>, now: Date = new Date()): DoseStatus =>
  doseState({ ...dose, status: null }, now) === 'missed' ? 'LATE' : 'TAKEN';

export const isTaken = (dose: Pick<AgendaDose, 'status'>) => dose.status === 'TAKEN' || dose.status === 'LATE';

// ---- Filtro por persona ----

export type Who = 'all' | 'me' | number;

export const matchesWho = (dose: AgendaDose, who: Who) =>
  who === 'all' || (who === 'me' ? dose.mine : !dose.mine && dose.careSubjectId === who);

/** «Yo» primero (si tengo tomas propias) y luego cada persona que cuido, por nombre. */
export function peopleIn(doses: AgendaDose[]): { id: Who; label: string }[] {
  const others = new Map<number, string>();
  for (const dose of doses) if (!dose.mine) others.set(dose.careSubjectId, dose.careSubjectName);
  return [
    ...(doses.some((dose) => dose.mine) ? [{ id: 'me' as Who, label: 'Yo' }] : []),
    ...[...others].sort((a, b) => a[1].localeCompare(b[1], 'es')).map(([id, label]) => ({ id: id as Who, label })),
  ];
}

// ---- Recordatorios en el celular ----

/** Cuánto se pospone un recordatorio con «Posponer». */
export const SNOOZE_MINUTES = 10;
/**
 * Se programan las tomas de los próximos 14 días, hasta 40 avisos: iOS admite 64 avisos pendientes
 * por app y también están los de las citas. Cada vez que se abre la app se renuevan.
 */
export const REMINDER_HORIZON_DAYS = 14;
export const MAX_DOSE_REMINDERS = 40;

/** Lo que se guarda dentro del aviso, para marcar la toma o posponerla desde la notificación. */
export interface DoseReminderData {
  kind: 'dose-reminder';
  userId: number;
  scheduleId: number;
  date: string;
  time: string;
  mine: boolean;
}

export function isDoseReminderData(value: unknown): value is DoseReminderData {
  const data = value as Partial<DoseReminderData> | null;
  return !!data && data.kind === 'dose-reminder' && typeof data.scheduleId === 'number';
}

/** Identificador fijo por cuenta y toma: reprogramar reemplaza el aviso en vez de duplicarlo. */
export const doseReminderId = (userId: number, scheduleId: number, date: string, time: string) =>
  `toma-${userId}-${scheduleId}-${date}-${shortTime(time).replace(':', '')}`;

/**
 * Texto de la notificación. No dice el medicamento ni la persona: se ve con el teléfono bloqueado.
 */
export function doseReminderContent(data: Pick<DoseReminderData, 'mine'>, snoozed = false) {
  const who = data.mine ? 'Es hora de tu medicamento.' : 'Es hora de una toma de alguien que cuidas.';
  return { title: snoozed ? 'Yuyay · recordatorio pospuesto' : 'Yuyay', body: `${who} Abre Yuyay para ver cuál.` };
}

/** Avisos a programar: tomas sin marcar, a su hora, que todavía no llegan y caen en los próximos 14 días. */
export function planDoseReminders(userId: number, doses: AgendaDose[], now: Date = new Date()) {
  const limit = now.getTime() + REMINDER_HORIZON_DAYS * 86_400_000;
  return doses
    .filter((dose) => !dose.status)
    .map((dose) => ({ dose, fire: doseDate(dose) }))
    .filter(({ fire }) => fire.getTime() > now.getTime() && fire.getTime() <= limit)
    .sort((a, b) => a.fire.getTime() - b.fire.getTime())
    .slice(0, MAX_DOSE_REMINDERS)
    .map(({ dose, fire }) => ({
      identifier: doseReminderId(userId, dose.scheduleId, dose.date, dose.time),
      fire,
      data: {
        kind: 'dose-reminder' as const,
        userId,
        scheduleId: dose.scheduleId,
        date: dose.date,
        time: shortTime(dose.time),
        mine: dose.mine,
      },
    }));
}

/**
 * Hasta cuándo quedan avisos programados: la última toma con aviso. Sirve para decirle a la persona
 * que abra Yuyay antes de esa fecha para renovarlos. null si no hay ninguno.
 */
export function remindersUntil(plan: { fire: Date }[]): Date | null {
  return plan.length ? plan[plan.length - 1].fire : null;
}

/** Clave de una toma, para comparar avisos con la agenda. */
export const doseKey = (dose: Pick<DoseReminderData, 'scheduleId' | 'date' | 'time'>) =>
  `${dose.scheduleId}|${dose.date}|${shortTime(dose.time)}`;

/**
 * Avisos pospuestos que ya no deben sonar: la toma ya se marcó (en este u otro celular) o ya no está
 * en la agenda (se quitó el horario o el acceso a la persona). Solo siguen los de tomas pendientes.
 */
export function staleSnoozed<T extends { identifier: string; data: DoseReminderData }>(snoozed: T[], doses: AgendaDose[]): T[] {
  const pending = new Set(doses.filter((dose) => !dose.status).map(doseKey));
  return snoozed.filter((reminder) => !pending.has(doseKey(reminder.data)));
}

/**
 * Evita que una sincronización vieja programe avisos después de cerrar sesión o de apagarlos: cada
 * sincronización guarda la versión con la que empezó, y cerrar sesión o apagar los avisos la cambia.
 */
export function createSyncGuard() {
  let version = 0;
  return {
    start: () => version,
    isCurrent: (started: number) => started === version,
    invalidate: () => {
      version += 1;
    },
  };
}
