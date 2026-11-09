import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, Text } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { HealthEntryCard } from '../components/HealthEntryCard';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getHealthEntries } from '../services/api';
import { fonts, makeStyles, useTheme } from '../theme';
import type { HomeStackParamList } from '../types';
import { EXAM_CATEGORY } from '../utils/categories';

type Props = NativeStackScreenProps<HomeStackParamList, 'Exams'>;

/** Resultados de exámenes pasados, del más reciente al más antiguo. */
export function ExamsScreen({ route, navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { subjectId } = route.params;
  const exams = useFetch(() => getHealthEntries(subjectId, EXAM_CATEGORY), [subjectId]);
  useRefreshOnFocus(exams.reload);

  if (exams.loading && !exams.data) return <LoadingView />;

  const list = [...(exams.data ?? [])].sort((a, b) =>
    (b.latestVersion.occurredOn ?? '').localeCompare(a.latestVersion.occurredOn ?? ''),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={exams.refreshing} onRefresh={exams.refresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.intro}>Guarda aquí los resultados de los exámenes que ya se hizo, con su foto si la tienes.</Text>
      <SubmitButton
        label="Agregar examen"
        icon="plus"
        onPress={() => navigation.navigate('NewEntry', { subjectId, categoryCode: EXAM_CATEGORY })}
      />
      <StatusMessage message={exams.error} />

      {list.length === 0 ? (
        <EmptyState title="Aún no hay exámenes" description="Los resultados que agregues aparecerán aquí." />
      ) : (
        list.map((exam) => (
          <HealthEntryCard
            key={exam.id}
            entry={exam}
            attachmentOpen
            onEdit={() => navigation.navigate('EditEntry', { subjectId, entryId: exam.id })}
            onHistory={() => navigation.navigate('EntryHistory', { subjectId, entryId: exam.id })}
          />
        ))
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
}));
