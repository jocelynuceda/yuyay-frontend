import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { AddToCalendar } from '../components/AddToCalendar';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { ReminderToggle } from '../components/ReminderToggle';
import { StatusMessage } from '../components/StatusMessage';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getCareSubjects, getConsultations } from '../services/api';
import { reconcileReminders } from '../services/reminders';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { appointmentOrder, formatTime, initialsOf, todayIso } from '../utils/format';
import { loadBySubject } from '../utils/loadBySubject';

type Props = NativeStackScreenProps<HomeStackParamList, 'UpcomingConsultations'>;

const monthShort = new Intl.DateTimeFormat('es-PE', { month: 'short' });
const weekdayLong = new Intl.DateTimeFormat('es-PE', { weekday: 'long' });

/** Días que faltan, en palabras: hoy, mañana, en 5 días. */
function daysUntil(date: string, today: string) {
  const days = Math.round((Date.parse(`${date}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

/**
 * Citas de hoy en adelante de todas las personas a cargo, la más cercana primero.
 * `loaded` guarda solo las listas que se pudieron leer, para reconciliar los avisos sin tocar las demás.
 */
async function loadUpcoming() {
  const subjects = await getCareSubjects();
  const { loaded, failed } = await loadBySubject(subjects.map((s) => s.id), getConsultations);
  const today = todayIso();
  const items = [...loaded.values()]
    .flat()
    .filter((c) => c.date >= today)
    .sort((a, b) => appointmentOrder(a).localeCompare(appointmentOrder(b)))
    .map((c) => ({ ...c, subject: subjects.find((s) => s.id === c.careSubjectId)! }));
  return { items, loaded, failed, subjectIds: new Set(subjects.map((s) => s.id)) };
}

export function UpcomingConsultationsScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const upcoming = useFetch(loadUpcoming);
  useRefreshOnFocus(upcoming.reload);
  const userId = useAuth().user?.id;

  useEffect(() => {
    if (userId !== undefined && upcoming.data) {
      void reconcileReminders(userId, upcoming.data.loaded, upcoming.data.subjectIds);
    }
  }, [userId, upcoming.data]);

  if (upcoming.loading && !upcoming.data) return <LoadingView />;

  const today = todayIso();
  const list = upcoming.data?.items ?? [];
  const failed = upcoming.data?.failed ?? 0;
  // Solo una carga completa permite afirmar que no hay citas
  const complete = upcoming.data !== null && !upcoming.error && !failed;

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={upcoming.refreshing} onRefresh={upcoming.refresh} tintColor={colors.primary} />
      }
    >
      <StatusMessage message={upcoming.error ?? (failed ? 'No pudimos cargar todas las citas.' : null)} />
      {upcoming.error || failed ? (
        <SubmitButton label="Reintentar" loading={upcoming.loading} onPress={upcoming.reload} />
      ) : null}

      {list.length === 0 && complete ? (
        <EmptyState
          title="No hay citas próximas"
          description="Regístralas desde Citas, en el perfil de cada persona."
        />
      ) : (
        list.map((c) => {
          const date = new Date(`${c.date}T12:00:00`);
          return (
            <View key={c.id} style={styles.row}>
              <View style={[styles.dateBlock, c.date === today && styles.dateToday]}>
                <Text style={[styles.dateDay, c.date === today && styles.dateTodayText]}>{date.getDate()}</Text>
                <Text style={[styles.dateMonth, c.date === today && styles.dateTodayText]}>
                  {monthShort.format(date).replace('.', '')}
                </Text>
              </View>
              <View style={styles.flex}>
                <ListItem
                  initials={initialsOf(c.subject.name)}
                  title={c.reason}
                  subtitle={`${c.subject.name} · ${daysUntil(c.date, today)}, ${weekdayLong.format(date)}${c.time ? `, ${formatTime(c.time)}` : ''}`}
                  footer={
                    <>
                      {c.notes ? <Text style={styles.notes}>{c.notes}</Text> : null}
                      <AddToCalendar consultation={c} subjectName={c.subject.name} />
                      <ReminderToggle consultation={c} />
                    </>
                  }
                  onPress={() =>
                    navigation.navigate('Consultations', {
                      subjectId: c.subject.id,
                      subjectName: c.subject.name,
                      isPrincipal: c.subject.myRole === 'PRINCIPAL',
                    })
                  }
                />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: { flex: 1 },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateBlock: {
    width: 54,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.accentTint,
    alignItems: 'center',
  },
  dateToday: { backgroundColor: colors.primary },
  dateDay: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  dateMonth: { fontFamily: fonts.semibold, fontSize: 12, color: colors.accentText, textTransform: 'uppercase' },
  dateTodayText: { color: colors.white },
  notes: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },
}));
