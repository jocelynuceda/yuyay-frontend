import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Consultation } from '../types';
import {
  LOCAL_REMINDER_BODY,
  LOCAL_REMINDER_TITLE,
  reconcileSubject,
  reminderTriggerDate,
  remindersWithoutAccess,
  type StoredReminder,
} from '../utils/localReminders';

/**
 * Avisos locales de citas (frontend #53): los programa este celular, sin pasar por el servidor.
 * Se guardan por cuenta para poder sincronizarlos y cancelarlos al cerrar sesión.
 */

const CHANNEL_ID = 'citas';
export const REMINDER_KIND = 'appointment-reminder';

/** En la web de Expo no hay avisos locales: el interruptor no se muestra. */
export const localRemindersAvailable = Platform.OS !== 'web';

if (localRemindersAvailable) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export interface ReminderData {
  kind: typeof REMINDER_KIND;
  userId: number;
  subjectId: number;
  subjectName: string;
  isPrincipal: boolean;
  [key: string]: unknown;
}

const storageKey = (userId: number) => `yuyay.localReminders.${userId}`;

// Las operaciones se encadenan para que dos cambios seguidos no se pisen al guardar
let queue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

async function load(userId: number): Promise<StoredReminder[]> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(userId));
    return raw ? (JSON.parse(raw) as StoredReminder[]) : [];
  } catch {
    return [];
  }
}

async function save(userId: number, reminders: StoredReminder[]) {
  if (reminders.length === 0) await SecureStore.deleteItemAsync(storageKey(userId));
  else await SecureStore.setItemAsync(storageKey(userId), JSON.stringify(reminders));
}

async function cancel(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

async function scheduleAt(trigger: Date, data: ReminderData): Promise<string> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de citas',
      importance: AndroidImportance.HIGH,
    });
  }
  return Notifications.scheduleNotificationAsync({
    content: { title: LOCAL_REMINDER_TITLE, body: LOCAL_REMINDER_BODY, data },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger, channelId: CHANNEL_ID },
  });
}

/** IDs de las citas con aviso activo en este celular. */
export function getActiveReminders(userId: number): Promise<Set<number>> {
  return serialized(async () => new Set((await load(userId)).map((r) => r.consultationId)));
}

export type EnableResult = 'scheduled' | 'denied' | 'unavailable';

/** Pide permiso solo al activar. Si se niega, la cita sigue igual y no se programa nada. */
export function enableReminder(
  userId: number,
  consultation: Consultation,
  subject: { subjectName: string; isPrincipal: boolean },
): Promise<EnableResult> {
  return serialized(async () => {
    const trigger = reminderTriggerDate(consultation);
    if (!localRemindersAvailable || !trigger) return 'unavailable';
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return 'denied';

    const stored = await load(userId);
    const previous = stored.find((r) => r.consultationId === consultation.id);
    if (previous) await cancel(previous.notificationId);
    const notificationId = await scheduleAt(trigger, {
      kind: REMINDER_KIND,
      userId,
      subjectId: consultation.careSubjectId,
      ...subject,
    });
    await save(userId, [
      ...stored.filter((r) => r.consultationId !== consultation.id),
      { consultationId: consultation.id, subjectId: consultation.careSubjectId, notificationId, triggerAt: trigger.toISOString() },
    ]);
    return 'scheduled';
  });
}

export function disableReminder(userId: number, consultationId: number): Promise<void> {
  return serialized(async () => {
    const stored = await load(userId);
    const reminder = stored.find((r) => r.consultationId === consultationId);
    if (reminder) await cancel(reminder.notificationId);
    await save(userId, stored.filter((r) => r.consultationId !== consultationId));
  });
}

/**
 * Sincroniza los avisos de una persona con sus citas actuales (también las que se editaron o
 * borraron desde otro celular o la web). Devuelve las citas que siguen con aviso.
 */
export function syncSubjectReminders(
  userId: number,
  subjectId: number,
  consultations: readonly Consultation[],
  subject: { subjectName: string; isPrincipal: boolean },
): Promise<Set<number>> {
  return serialized(async () => {
    let stored = await load(userId);
    for (const action of reconcileSubject(stored, subjectId, consultations)) {
      await cancel(action.reminder.notificationId);
      stored = stored.filter((r) => r.consultationId !== action.reminder.consultationId);
      if (action.kind === 'reschedule') {
        const notificationId = await scheduleAt(action.trigger, { kind: REMINDER_KIND, userId, subjectId, ...subject });
        stored.push({ ...action.reminder, notificationId, triggerAt: action.trigger.toISOString() });
      }
    }
    await save(userId, stored);
    return new Set(stored.filter((r) => r.subjectId === subjectId).map((r) => r.consultationId));
  });
}

/** Cancela los avisos de personas a las que la cuenta ya no tiene acceso. */
export function dropRemindersWithoutAccess(userId: number, subjectIds: readonly number[]): Promise<void> {
  return serialized(async () => {
    const stored = await load(userId);
    const lost = remindersWithoutAccess(stored, subjectIds);
    if (lost.length === 0) return;
    for (const reminder of lost) await cancel(reminder.notificationId);
    await save(userId, stored.filter((r) => !lost.includes(r)));
  });
}

/** Al cerrar sesión: no deben quedar avisos de esta cuenta en el celular. */
export function cancelAllReminders(userId: number): Promise<void> {
  return serialized(async () => {
    if (!localRemindersAvailable) return;
    for (const reminder of await load(userId)) await cancel(reminder.notificationId);
    await save(userId, []);
  });
}
