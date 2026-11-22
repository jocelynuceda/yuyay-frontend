import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { disableReminder, enableReminder, remindersSupported, useReminderActive } from '../services/reminders';
import { fonts, makeStyles, useTheme } from '../theme';
import type { Consultation } from '../types';
import { reminderFireDate } from '../utils/reminders';

/**
 * Activa o quita un aviso local una hora antes de la cita. Solo en el celular y para citas futuras con hora;
 * el aviso queda en este dispositivo, no en la cuenta.
 */
export function ReminderToggle({ consultation }: { consultation: Consultation }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const toast = useToast();
  const on = useReminderActive(user?.id, consultation.id);
  const [busy, setBusy] = useState(false);

  if (!remindersSupported || !user || (!on && !reminderFireDate(consultation))) return null;

  async function toggle() {
    if (!user) return;
    setBusy(true);
    try {
      if (on) {
        await disableReminder(user.id, consultation.id);
        toast('Aviso quitado de este celular.');
        return;
      }
      const result = await enableReminder(user.id, consultation);
      if (result === 'scheduled') toast('Te avisaremos en este celular una hora antes.');
      else if (result === 'denied')
        toast('Sin permiso de notificaciones no podemos avisarte. La cita sigue guardada.');
      else toast('Falta menos de una hora para la cita.');
    } catch {
      toast('No pudimos programar el aviso en este celular.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={toggle}
      disabled={busy}
      hitSlop={6}
      style={({ pressed }) => [styles.action, (pressed || busy) && { opacity: 0.6 }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: busy }}
      accessibilityHint="El aviso se programa solo en este dispositivo"
    >
      <Ionicons name={on ? 'notifications' : 'notifications-outline'} size={15} color={colors.primary} />
      <Text style={styles.label}>{on ? 'Aviso 1 h antes en este celular · Quitar' : 'Avisarme 1 h antes en este celular'}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginLeft: 56 },
  label: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
}));
