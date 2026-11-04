import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import type { Consultation } from '../types';
import {
  APPOINTMENT_MINUTES,
  type CalendarTime,
  googleCalendarUrl,
  parseTime,
  savedTime,
  TIME_ERROR,
  type TimeParts,
} from '../utils/calendar';
import { formatDate } from '../utils/format';
import { SubmitButton } from './FormKit';
import { TimeField } from './TimeField';

/** Acción al pie de una cita (alineada con el texto de ListItem) para llevarla a Google Calendar. */
export function AddToCalendar({ consultation, subjectName }: { consultation: Consultation; subjectName: string }) {
  const [asking, setAsking] = useState(false);

  function openCalendar(time?: CalendarTime) {
    setAsking(false);
    void Linking.openURL(googleCalendarUrl(consultation, subjectName, time));
  }

  return (
    <>
      <Pressable
        // Si la cita ya tiene hora no hace falta preguntarla
        onPress={() => (consultation.time ? openCalendar(savedTime(consultation.time)) : setAsking(true))}
        hitSlop={6}
        style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
      >
        <Ionicons name="calendar-outline" size={15} color={colors.primary} />
        <Text style={styles.label}>Agregar a Google Calendar</Text>
      </Pressable>
      {asking ? (
        <TimeDialog consultation={consultation} onConfirm={openCalendar} onCancel={() => setAsking(false)} />
      ) : null}
    </>
  );
}

/** Se monta al abrirse, para empezar siempre con la hora sugerida. */
function TimeDialog({
  consultation,
  onConfirm,
  onCancel,
}: {
  consultation: Consultation;
  onConfirm: (time?: CalendarTime) => void;
  onCancel: () => void;
}) {
  const [parts, setParts] = useState<TimeParts>({ hour: '9', minute: '00', period: 'am' });
  const [invalid, setInvalid] = useState(false);

  function handleConfirm() {
    const time = parseTime(parts);
    setInvalid(!time);
    if (time) onConfirm(time);
  }

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <View style={styles.dialog}>
          <Text style={styles.title}>¿A qué hora es la cita?</Text>
          <Text style={styles.help}>
            {consultation.reason} · {formatDate(consultation.date)}. Se agendará por {APPOINTMENT_MINUTES / 60} hora;
            puedes cambiarlo en Google Calendar.
          </Text>

          <TimeField value={parts} onChange={setParts} error={invalid ? TIME_ERROR : undefined} />

          <SubmitButton label="Abrir Google Calendar" icon="calendar-plus" onPress={handleConfirm} />
          <View style={styles.secondary}>
            <Pressable onPress={() => onConfirm()} hitSlop={6} accessibilityRole="button">
              <Text style={styles.label}>Todo el día</Text>
            </Pressable>
            <Pressable onPress={onCancel} hitSlop={6} accessibilityRole="button">
              <Text style={styles.cancel}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, marginLeft: 56 },
  label: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  dialog: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 20, gap: 12 },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  help: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  secondary: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  cancel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted },
});
