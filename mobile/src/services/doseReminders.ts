import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import {
  addDays,
  createSyncGuard,
  doseReminderContent,
  isDoseReminderData,
  planDoseReminders,
  REMINDER_HORIZON_DAYS,
  remindersUntil,
  SNOOZE_MINUTES,
  staleSnoozed,
  takenStatusFor,
  todayInLima,
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
/** Hasta cuándo hay avisos programados en este celular (la última toma con aviso). */
let until: Date | null = null;
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach((notify) => notify());
const setEnabled = (value: boolean) => {
  enabled = value;
  notifyAll();
};
const setUntil = (value: Date | null) => {
  until = value;
  notifyAll();
};

// Cerrar sesión o apagar los avisos invalida la sincronización en curso
const syncGuard = createSyncGuard();

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

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

/** Hasta cuándo quedan avisos programados en este celular, o null si no hay. */
export function useDoseRemindersUntil() {
  return useSyncExternalStore(subscribe, () => until);
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

const isSnoozed = (data: unknown) => !!(data as { snoozed?: boolean } | null)?.snoozed;

/** Cancela todos los avisos de tomas de este celular, también los pospuestos. */
async function cancelScheduled() {
  const scheduled = await scheduledDoseReminders();
  await Promise.all(scheduled.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
}

/**
 * Vuelve a programar los avisos de los próximos 14 días con la agenda del servidor: las tomas ya marcadas
 * (en este u otro celular) dejan de sonar y las nuevas se agregan. Un aviso pospuesto se conserva solo
 * mientras su toma siga pendiente y la persona siga en la agenda.
 */
export async function syncDoseReminders(userId: number) {
  if (!doseRemindersSupported || !(await loadEnabled())) return;
  const started = syncGuard.start();
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted || !syncGuard.isCurrent(started)) return;
    const today = todayInLima();
    // Desde ayer: un aviso pospuesto puede ser de una toma de anoche
    const doses = await getMedicationAgenda(addDays(today, -1), addDays(today, REMINDER_HORIZON_DAYS));
    // Si mientras tanto se cerró sesión o se apagaron los avisos, esta respuesta ya no vale
    if (!syncGuard.isCurrent(started)) return;
    await configure();
    const scheduled = await scheduledDoseReminders();
    const snoozed = scheduled
      .filter((n) => isSnoozed(n.content.data))
      .map((n) => ({ identifier: n.identifier, data: n.content.data as unknown as DoseReminderData }));
    const toCancel = [
      ...scheduled.filter((n) => !isSnoozed(n.content.data)).map((n) => n.identifier),
      ...staleSnoozed(snoozed, doses).map((n) => n.identifier),
    ];
    await Promise.all(toCancel.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
    const plan = planDoseReminders(userId, doses);
    for (const reminder of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { ...doseReminderContent(reminder.data), data: { ...reminder.data }, categoryIdentifier: CATEGORY_ID },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.fire, channelId: CHANNEL_ID },
      });
      // Se cerró sesión mientras se programaba este aviso: se quita y no se sigue
      if (!syncGuard.isCurrent(started)) {
        await Notifications.cancelScheduledNotificationAsync(reminder.identifier);
        return;
      }
    }
    setUntil(remindersUntil(plan));
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
  syncGuard.invalidate();
  setUntil(null);
  if (doseRemindersSupported) await cancelScheduled().catch(() => undefined);
}

/** Al cerrar sesión: los avisos son de esta cuenta y no deben sonar para la siguiente. */
export async function cancelAllDoseReminders() {
  // Antes de cancelar: una sincronización que todavía esperaba la agenda ya no programará nada
  syncGuard.invalidate();
  setUntil(null);
  if (!doseRemindersSupported) return;
  await cancelScheduled().catch(() => undefined);
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
