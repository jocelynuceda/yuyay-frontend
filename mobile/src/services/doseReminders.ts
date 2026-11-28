import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import {
  addDays,
  createReminderPreference,
  createReminderSync,
  doseReminderContent,
  isDoseReminderData,
  REMINDER_HORIZON_DAYS,
  SNOOZE_MINUTES,
  takenStatusFor,
  todayInLima,
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

// La preferencia se guarda en cola (ver utils); `activeUserId` se lee al momento de usarla, ya declarada
const preference = createReminderPreference(
  {
    read: () => SecureStore.getItemAsync(ENABLED_KEY),
    write: () => SecureStore.setItemAsync(ENABLED_KEY, '1'),
    remove: () => SecureStore.deleteItemAsync(ENABLED_KEY),
  },
  () => activeUserId,
);

let loaded: Promise<boolean> | null = null;
function loadEnabled() {
  loaded ??= preference.load().then((value) => {
    setEnabled(value);
    return value;
  });
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

/** La cuenta con sesión en este celular. Los avisos solo se programan a su nombre. */
let activeUserId: number | null = null;

/** Lo llama la sesión al entrar (o al perderla, con null). */
export function setDoseReminderUser(userId: number | null) {
  activeUserId = userId;
}

// La sincronización (la más reciente manda, de a una) vive en utils y se prueba sin el celular
const reminders = createReminderSync(
  {
    list: async () =>
      (await Notifications.getAllScheduledNotificationsAsync()).map((n) => ({ identifier: n.identifier, data: n.content.data })),
    cancel: (identifier) => Notifications.cancelScheduledNotificationAsync(identifier),
    schedule: async ({ identifier, fire, data, snoozed }) => {
      await configure();
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: { ...doseReminderContent(data, snoozed), data: { ...data, snoozed }, categoryIdentifier: CATEGORY_ID },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire, channelId: CHANNEL_ID },
      });
    },
  },
  // La preferencia vigente en el momento de actuar, no la de cuando empezó
  () => (doseRemindersSupported ? loadEnabled() : Promise.resolve(false)),
  () => activeUserId,
);

/**
 * Vuelve a programar los avisos de los próximos 14 días con la agenda del servidor: las tomas ya marcadas
 * (en este u otro celular) dejan de sonar y las nuevas se agregan. Un aviso pospuesto se conserva solo
 * mientras su toma siga pendiente y la persona siga en la agenda.
 */
export async function syncDoseReminders(userId: number) {
  if (!doseRemindersSupported) return;
  try {
    // La sincronización toma su turno aquí, antes de esperar nada: si mientras tanto se cierra sesión,
    // ni la preferencia, ni el permiso, ni la agenda de esta cuenta llegan a programar avisos
    const result = await reminders.sync(userId, async () => {
      if (!(await loadEnabled())) return null;
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return null;
      const today = todayInLima();
      // Desde ayer: un aviso pospuesto puede ser de una toma de anoche
      return getMedicationAgenda(addDays(today, -1), addDays(today, REMINDER_HORIZON_DAYS));
    });
    if (result !== undefined) setUntil(result);
  } catch {
    // Sin conexión: los avisos quedan como estaban hasta la próxima sincronización
  }
}

/** 'cancelled': mientras se pedía el permiso, la sesión cambió de cuenta; no se activó nada. */
export type EnableResult = 'enabled' | 'denied' | 'cancelled';

/** Pide permiso solo cuando la persona activa los avisos. */
export async function enableDoseReminders(userId: number): Promise<EnableResult> {
  if (activeUserId !== userId) return 'cancelled';
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
  // Mientras se esperaba el permiso, esta cuenta cerró sesión: no se activa nada a su nombre
  if (activeUserId !== userId) return 'cancelled';
  if (!permission.granted) return 'denied';
  // Se guarda en la cola de la preferencia: si la cuenta salió mientras se guardaba, no queda encendido
  if (!(await preference.enable(userId))) return 'cancelled';
  loaded = Promise.resolve(true);
  setEnabled(true);
  await syncDoseReminders(userId);
  return 'enabled';
}

export async function disableDoseReminders() {
  await preference.disable();
  loaded = Promise.resolve(false);
  setEnabled(false);
  setUntil(null);
  if (doseRemindersSupported) await reminders.stop().catch(() => undefined);
}

/** Al cerrar sesión: los avisos son de esta cuenta y no deben sonar para la siguiente. */
export async function cancelAllDoseReminders() {
  // Una sincronización o activación que todavía esperaba ya no programará nada
  activeUserId = null;
  setUntil(null);
  if (!doseRemindersSupported) return;
  await reminders.stop().catch(() => undefined);
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
    // Si se apagaron los avisos después de que llegó esta notificación, ya no se pospone
    const snoozed = await reminders.snooze(data).catch(() => false);
    return snoozed ? `Te lo recordamos en ${SNOOZE_MINUTES} minutos.` : 'Los avisos están apagados en este celular.';
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
