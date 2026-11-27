import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { VersionCard } from '../components/VersionCard';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getConsultation, getConsultationChanges } from '../services/api';
import { fonts, makeStyles, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { formatDate } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'ConsultationChanges'>;

export function ConsultationChangesScreen({ route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId, consultationId } = route.params;
  const changes = useFetch(async () => {
    const [consultation, versions] = await Promise.all([
      getConsultation(subjectId, consultationId),
      getConsultationChanges(subjectId, consultationId),
    ]);
    return { since: consultation.date, versions };
  }, [subjectId, consultationId]);
  useRefreshOnFocus(changes.reload);

  if (changes.loading && !changes.data) return <LoadingView />;

  // Lo más reciente primero
  const list = [...(changes.data?.versions ?? [])].sort((a, b) => b.declaredAt.localeCompare(a.declaredAt));

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={changes.refreshing} onRefresh={changes.refresh} tintColor={colors.primary} />
      }
    >
      {changes.data && <Text style={styles.intro}>Lo que se creó, editó o borró desde el {formatDate(changes.data.since)}.</Text>}
      <StatusMessage message={changes.error} />
      {changes.data && list.length === 0 ? <EmptyState title="Sin cambios" description="Nada cambió desde esta cita." /> : null}
      {list.map((v) => (
        <VersionCard key={v.id} subjectId={subjectId} version={v} />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
}));
