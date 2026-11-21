import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { localRemindersAvailable, REMINDER_KIND, type ReminderData } from '../services/localReminders';
import type { RootStackParamList } from '../types';

function isReminderData(data: unknown): data is ReminderData {
  return typeof data === 'object' && data !== null && (data as { kind?: unknown }).kind === REMINDER_KIND;
}

/**
 * Al tocar un aviso local de cita se abren las citas de esa persona, solo si el aviso es de la
 * cuenta que tiene la sesión abierta.
 */
export function ReminderResponseHandler({ navigation }: { navigation: NavigationContainerRefWithCurrent<RootStackParamList> }) {
  if (!localRemindersAvailable) return null;
  return <Handler navigation={navigation} />;
}

function Handler({ navigation }: { navigation: NavigationContainerRefWithCurrent<RootStackParamList> }) {
  const { status, user } = useAuth();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    const data = response?.notification.request.content.data;
    if (!isReminderData(data) || status !== 'authenticated' || user?.id !== data.userId || !navigation.isReady()) return;
    const params = { subjectId: data.subjectId, subjectName: data.subjectName, isPrincipal: data.isPrincipal };
    navigation.navigate('Main', { screen: 'HomeTab', params: { screen: 'Consultations', params } } as never);
    void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
  }, [response, status, user?.id, navigation]);

  return null;
}
