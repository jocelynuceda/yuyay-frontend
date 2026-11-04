import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { AddToCalendar } from '../components/AddToCalendar';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { IconButton, ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { deleteConsultation, getConsultations } from '../services/api';
import { ApiError } from '../services/http';
import { colors, fonts } from '../theme';
import type { Consultation, HomeStackParamList } from '../types';
import { confirmAction } from '../utils/confirm';
import { appointmentOrder, formatDate, formatTime, todayIso } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'Consultations'>;

export function ConsultationsScreen({ route, navigation }: Props) {
  const { subjectId, subjectName, isPrincipal } = route.params;
  const [error, setError] = useState<string | null>(null);
  const consultations = useFetch(() => getConsultations(subjectId), [subjectId]);
  useRefreshOnFocus(consultations.reload);

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

  async function handleDelete(c: Consultation) {
    if (!(await confirmAction('Borrar cita', `"${c.reason}" del ${formatDate(c.date)}.`, 'Borrar'))) return;
    setError(null);
    try {
      await deleteConsultation(c.id);
      consultations.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No pudimos borrar la cita.');
    }
  }

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
        upcomingItem ? (
          <AddToCalendar consultation={c} subjectName={subjectName} />
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
        )
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

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  changes: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary, marginTop: 10, marginLeft: 56 },
  section: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 8 },
});
