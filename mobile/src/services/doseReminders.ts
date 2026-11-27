import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import {
  addDays,
  doseReminderContent,
  isDoseReminderData,
  isoDate,
  planDoseReminders,
  SNOOZE_MINUTES,
  takenStatusFor,
  type DoseReminderData,
} from '../utils/medicationSchedule';
import { getMedicationAgenda, markDose } from './api';

/**
 * Recordatorios de cada toma: avisos locales en este celular, a la hora de la toma, con los botones
 * «Tomada» y «Posponer». Se activan desde la agenda del inicio y quedan en el dispositivo, no en la cuenta.
 */
export const doseRemindersSupported = Platform.OS === 'android' || Platform.OS === 'ios';

const CHANNEL_ID = 'tomas';
const CATEGORY_ID = 'toma';
const ENABLED_KEY = 'yuyay.doseReminders';
export const ACTION_TAKEN = 'TOMADA';
export const ACTION_SNOOZE = 'POSPONER';

let configured: Promise<void> | null = null;

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
        name: 'Recordatorios de medicamentos',
        importance: AndroidImportance.HIGH,
        // El texto no nombra el medicamento ni la persona
        lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
      });
    }
    // Los dos botones abren la app: así la acción llega aunque el sistema la haya cerrado
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      { identifier: ACTION_TAKEN, buttonTitle: 'Tomada', options: { opensAppToForeground: true } },
      { identifier: ACTION_SNOOZE, buttonTitle: `Posponer ${SNOOZE_MINUTES} min`, options: { opensAppToForeground: true } },
    ]);
  })();
  return configured;
}

// ---- Interruptor «Avisarme en este celular» ----

let enabled = false;
const listeners = new Set<() => void>();
const setEnabled = (value: boolean) => {
  enabled = value;
  listeners.forEach((notify) => notify());
};

let loaded: Promise<boolean> | null = null;
function loadEnabled() {
  loaded ??= SecureStore.getItemAsync(ENABLED_KEY)
    .then((value) => {
      setEnabled(value === '1');
      return value === '1';
    })
    .catch(() => false);
  return loaded;
}

export function useDoseRemindersEnabled() {
  void loadEnabled();
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => enabled,
  );
}

async function scheduledDoseReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter((n) => isDoseReminderData(n.content.data));
}

/** Sin `withSnoozed`, los avisos pospuestos se conservan: la persona pidió que vuelvan a sonar. */
async function cancelScheduled(withSnoozed = false) {
  const scheduled = (await scheduledDoseReminders()).filter(
    (n) => withSnoozed || !(n.content.data as { snoozed?: boolean }).snoozed,
  );
  await Promise.all(scheduled.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/**
 * Vuelve a programar los avisos de las próximas 48 h con la agenda del servidor: las tomas ya marcadas
 * (en este u otro celular) dejan de sonar y las nuevas se agregan.
 */
export async function syncDoseReminders(userId: number) {
  if (!doseRemindersSupported || !(await loadEnabled())) return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;
    const today = isoDate(new Date());
    const doses = await getMedicationAgenda(today, addDays(today, 2));
    await configure();
    await cancelScheduled();
    for (const reminder of planDoseReminders(userId, doses)) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { ...doseReminderContent(reminder.data), data: { ...reminder.data }, categoryIdentifier: CATEGORY_ID },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fire, channelId: CHANNEL_ID },
      });
    }
  } catch {
    // Sin conexión: los avisos quedan como estaban hasta la próxima sincronización
  }
}

export type EnableResult = 'enabled' | 'denied';

/** Pide permiso solo cuando la persona activa los avisos. */
export async function enableDoseReminders(userId: number): Promise<EnableResult> {
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';
  await SecureStore.setItemAsync(ENABLED_KEY, '1');
  loaded = Promise.resolve(true);
  setEnabled(true);
  await syncDoseReminders(userId);
  return 'enabled';
}

export async function disableDoseReminders() {
  await SecureStore.deleteItemAsync(ENABLED_KEY).catch(() => undefined);
  loaded = Promise.resolve(false);
  setEnabled(false);
  if (doseRemindersSupported) await cancelScheduled(true).catch(() => undefined);
}

/** Al cerrar sesión: los avisos son de esta cuenta y no deben sonar para la siguiente. */
export async function cancelAllDoseReminders() {
  if (!doseRemindersSupported) return;
  await cancelScheduled(true).catch(() => undefined);
}

/**
 * Respuesta a un aviso de toma. «Tomada» la marca (como «se tomó tarde» si ya pasó el plazo) y
 * «Posponer» la vuelve a avisar en 10 minutos. Devuelve un texto para mostrar, o null si no era de tomas.
 */
export async function handleDoseReminderResponse(
  response: Notifications.NotificationResponse,
  userId: number,
): Promise<string | null> {
  const data = response.notification.request.content.data;
  if (!isDoseReminderData(data) || data.userId !== userId) return null;
  if (response.actionIdentifier === ACTION_SNOOZE) {
    await snooze(data);
    return `Te lo recordamos en ${SNOOZE_MINUTES} minutos.`;
  }
  if (response.actionIdentifier === ACTION_TAKEN) {
    try {
      const status = takenStatusFor(data);
      await markDose(data.scheduleId, { date: data.date, time: data.time, status });
      return status === 'LATE' ? 'Marcada como tomada tarde.' : 'Toma marcada como tomada.';
    } catch {
      return 'No pudimos marcar la toma. Márcala desde el inicio.';
    }
  }
  return null;
}

async function snooze(data: DoseReminderData) {
  await configure();
  await Notifications.scheduleNotificationAsync({
    identifier: `toma-pospuesta-${data.userId}-${data.scheduleId}-${data.date}-${data.time.replace(':', '')}`,
    content: { ...doseReminderContent(data, true), data: { ...data, snoozed: true }, categoryIdentifier: CATEGORY_ID },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + SNOOZE_MINUTES * 60_000),
      channelId: CHANNEL_ID,
    },
  });
}

// Una misma respuesta puede llegar por el listener y por getLastNotificationResponseAsync al abrir la app
const handled = new Set<string>();

/**
 * Escucha las respuestas a los avisos de tomas mientras hay sesión, también la que abrió la app.
 * `notify` muestra el resultado (por ejemplo, con un toast).
 */
export function listenDoseReminderResponses(userId: number, notify: (message: string) => void) {
  if (!doseRemindersSupported) return () => undefined;
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response || !isDoseReminderData(response.notification.request.content.data)) return;
    const key = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
    if (handled.has(key)) return;
    handled.add(key);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    void handleDoseReminderResponse(response, userId).then((message) => {
      if (message) notify(message);
      void syncDoseReminders(userId);
    });
  };
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
