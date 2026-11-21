import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { AddToCalendar } from '../components/AddToCalendar';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { IconButton, ListItem } from '../components/ListItem';
import { LocalReminderToggle } from '../components/LocalReminderToggle';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useConfirmedAction } from '../hooks/useConfirmedAction';
import { useFetch } from '../hooks/useFetch';
import { useLocalReminders } from '../hooks/useLocalReminders';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { deleteConsultation, getConsultations } from '../services/api';
import { fonts, makeStyles, useTheme } from '../theme';
import type { Consultation, HomeStackParamList } from '../types';
import { appointmentOrder, formatDate, formatTime, todayIso } from '../utils/format';
import { reminderTriggerDate } from '../utils/localReminders';

type Props = NativeStackScreenProps<HomeStackParamList, 'Consultations'>;

export function ConsultationsScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId, subjectName, isPrincipal } = route.params;
  const [error, setError] = useState<string | null>(null);
  const runAction = useConfirmedAction(setError);
  const consultations = useFetch(() => getConsultations(subjectId), [subjectId]);
  useRefreshOnFocus(consultations.reload);
  // Avisos locales de este celular: se sincronizan cada vez que llegan las citas
  const reminders = useLocalReminders(subjectId, consultations.data, { subjectName, isPrincipal });

  if (consultations.loading && !consultations.data) return <LoadingView />;

  const today = todayIso();
  const all = consultations.data ?? [];
  // Próximas: la más cercana primero. Pasadas: la más reciente primero.
  const upcoming = all
    .filter((c) => c.date >= today)
    .sort((a, b) => appointmentOrder(a).localeCompare(appointmentOrder(b)));
  const past = all
    .filter((c) => c.date < today)
    .sort((a, b) => appointmentOrder(b).localeCompare(appointmentOrder(a)));

  const handleDelete = (c: Consultation) =>
    runAction({
      confirm: ['Borrar cita', `"${c.reason}" del ${formatDate(c.date)}.`, 'Borrar'],
      action: () => deleteConsultation(c.id),
      success: 'Cita borrada.',
      fallback: 'No pudimos borrar la cita.',
      onDone: consultations.reload,
    });

  const renderItem = (c: Consultation, upcomingItem: boolean) => (
    <ListItem
      key={c.id}
      icon={upcomingItem ? 'calendar' : 'calendar-outline'}
      iconBg={upcomingItem ? colors.accentTint : colors.surface}
      iconFg={upcomingItem ? colors.accentText : colors.muted}
      title={c.reason}
      subtitle={[formatDate(c.date), c.time && formatTime(c.time), c.notes].filter(Boolean).join(' · ')}
      onPress={isPrincipal ? () => navigation.navigate('NewConsultation', { subjectId, consultation: c }) : undefined}
      footer={
        <View>
          {upcomingItem ? (
            <>
              <AddToCalendar consultation={c} subjectName={subjectName} />
              {reminders.available && reminderTriggerDate(c) ? (
                <LocalReminderToggle
                  active={reminders.active.has(c.id)}
                  busy={reminders.busy === c.id}
                  denied={reminders.denied === c.id}
                  onChange={(value) => void reminders.toggle(c, value)}
                />
              ) : null}
            </>
          ) : (
            <Pressable
              onPress={() =>
                navigation.navigate('ConsultationChanges', { subjectId, consultationId: c.id, since: c.date })
              }
              hitSlop={6}
              accessibilityRole="button"
            >
              <Text style={styles.changes}>Ver cambios desde esta cita</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => navigation.navigate('NewHandoff', { subjectId, isPrincipal, consultationId: c.id })}
            hitSlop={6}
            accessibilityRole="button"
          >
            <Text style={styles.changes}>Preparar resumen</Text>
          </Pressable>
        </View>
      }
      right={
        isPrincipal ? (
          <IconButton icon="trash-outline" label={`Borrar ${c.reason}`} color={colors.danger} onPress={() => handleDelete(c)} />
        ) : null
      }
    />
  );

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={consultations.refreshing}
          onRefresh={consultations.refresh}
          tintColor={colors.primary}
        />
      }
    >
      {isPrincipal ? (
        <SubmitButton
          label="Registrar cita"
          icon="calendar-plus"
          onPress={() => navigation.navigate('NewConsultation', { subjectId })}
        />
      ) : (
        <Text style={styles.intro}>Solo el cuidador principal puede registrar citas.</Text>
      )}

      <StatusMessage message={error ?? consultations.error} />

      {all.length === 0 ? (
        <EmptyState title="Aún no hay citas" description="Registra las próximas citas y las visitas al médico." />
      ) : null}

      {upcoming.length > 0 ? <Text style={styles.section}>Próximas</Text> : null}
      {upcoming.map((c) => renderItem(c, true))}

      {past.length > 0 ? <Text style={styles.section}>Anteriores</Text> : null}
      {past.map((c) => renderItem(c, false))}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  changes: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary, marginTop: 10, marginLeft: 56 },
  section: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 8 },
}));
