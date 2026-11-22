import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { Consultation } from '../types';
import {
  isReminderData,
  planReconcile,
  REMINDER_CONTENT,
  reminderDataOf,
  reminderFireDate,
  reminderId,
  type ReminderCitation,
  type ScheduledReminder,
} from '../utils/reminders';
import { getCareSubjects, getConsultations } from './api';

/**
 * Avisos locales de citas: se programan en este dispositivo, no en el servidor.
 * Web no está cubierta por esta implementación.
 */
export const remindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

const CHANNEL_ID = 'citas';

let configured: Promise<void> | null = null;

/** Muestra el aviso aunque la app esté abierta y crea el canal de Android (una sola vez). */
function configure() {
  configured ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Recordatorios de citas',
        importance: AndroidImportance.HIGH,
        // El texto no tiene información clínica, así que puede verse con el teléfono bloqueado
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      });
    }
  })();
  return configured;
}

// Identificadores de los avisos programados, para que la interfaz sepa cuáles están activos
let active = new Set<string>();
const listeners = new Set<() => void>();

async function readScheduled(): Promise<ScheduledReminder[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const reminders = all.flatMap((n) =>
    isReminderData(n.content.data) ? [{ identifier: n.identifier, data: n.content.data }] : [],
  );
  active = new Set(reminders.map((r) => r.identifier));
  listeners.forEach((notify) => notify());
  return reminders;
}

/** Lista reactiva de avisos activos; `true` si la cita tiene aviso en este dispositivo. */
export function useReminderActive(userId: number | undefined, consultationId: number) {
  const ids = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => active,
  );
  return userId !== undefined && ids.has(reminderId(userId, consultationId));
}

async function schedule(userId: number, c: ReminderCitation) {
  const fire = reminderFireDate(c);
  if (!fire) return false;
  await configure();
  // Mismo identificador: reemplaza el aviso anterior de esa cita en lugar de sumar otro
  await Notifications.scheduleNotificationAsync({
    identifier: reminderId(userId, c.id),
    content: { ...REMINDER_CONTENT, data: { ...reminderDataOf(userId, c) } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire, channelId: CHANNEL_ID },
  });
  return true;
}

export type EnableResult = 'scheduled' | 'denied' | 'too-late';

/** Pide permiso solo cuando la persona activa el aviso. Si lo niega, la cita sigue igual. */
export async function enableReminder(userId: number, c: ReminderCitation): Promise<EnableResult> {
  if (!reminderFireDate(c)) return 'too-late';
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';
  const scheduled = await schedule(userId, c);
  await readScheduled();
  return scheduled ? 'scheduled' : 'too-late';
}

export async function disableReminder(userId: number, consultationId: number) {
  if (!remindersSupported) return;
  await Notifications.cancelScheduledNotificationAsync(reminderId(userId, consultationId));
  await readScheduled();
}

/** Después de editar una cita en este dispositivo: mueve su aviso o lo quita si ya no aplica. */
export async function syncReminder(userId: number, c: Consultation) {
  if (!remindersSupported) return;
  const scheduled = await readScheduled();
  if (!scheduled.some((r) => r.identifier === reminderId(userId, c.id))) return;
  if (!(await schedule(userId, c))) await Notifications.cancelScheduledNotificationAsync(reminderId(userId, c.id));
  await readScheduled();
}

/**
 * Pone al día los avisos con citas recién leídas del servidor (editadas, borradas o movidas en otro cliente).
 * Sin permiso de notificaciones los avisos no sonarían, así que se quitan para no mostrarlos como activos.
 */
export async function reconcileReminders(
  userId: number,
  loaded: Map<number, ReminderCitation[]>,
  knownSubjects?: Set<number>,
) {
  if (!remindersSupported) return;
  try {
    const scheduled = await readScheduled();
    if (scheduled.length === 0) return;
    const permission = await Notifications.getPermissionsAsync();
    const plan = permission.granted
      ? planReconcile(scheduled, loaded, userId, { knownSubjects })
      : { cancel: scheduled.map((r) => r.identifier), reschedule: [] };
    await Promise.all(plan.cancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    for (const c of plan.reschedule) await schedule(userId, c);
    if (plan.cancel.length || plan.reschedule.length) await readScheduled();
  } catch {
    // Un fallo aquí no debe romper la lista de citas; se reintenta en la próxima carga
  }
}

/** Al abrir la app con sesión: si hay avisos guardados, los compara con todas las citas del servidor. */
export async function reconcileAllReminders(userId: number) {
  if (!remindersSupported) return;
  try {
    if ((await readScheduled()).length === 0) return;
    const subjects = await getCareSubjects();
    const loaded = new Map<number, Consultation[]>();
    await Promise.all(
      subjects.map((s) =>
        getConsultations(s.id).then(
          (list) => void loaded.set(s.id, list),
          () => undefined,
        ),
      ),
    );
    await reconcileReminders(userId, loaded, new Set(subjects.map((s) => s.id)));
  } catch {
    // Sin conexión: los avisos quedan como estaban hasta la próxima sincronización
  }
}

/** Al cerrar sesión se cancelan los avisos de citas de este dispositivo. */
export async function cancelAllReminders() {
  if (!remindersSupported) return;
  try {
    const scheduled = await readScheduled();
    await Promise.all(scheduled.map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)));
    await readScheduled();
  } catch {
    // Si falla, la próxima sesión los cancela al reconciliar (son de otra cuenta o de citas ajenas)
  }
}
