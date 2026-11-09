import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { VersionCard } from '../components/VersionCard';
import { useFetch } from '../hooks/useFetch';
import { getEntryVersions } from '../services/api';
import { useTheme } from '../theme';
import type { HomeStackParamList } from '../types';

type Props = NativeStackScreenProps<HomeStackParamList, 'EntryHistory'>;

export function EntryHistoryScreen({ route }: Props) {
  const { colors } = useTheme();
  const { subjectId, entryId } = route.params;
  const versions = useFetch(() => getEntryVersions(subjectId, entryId), [subjectId, entryId]);

  if (versions.loading && !versions.data) return <LoadingView />;

  // La versión más nueva primero
  const list = [...(versions.data ?? [])].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={versions.refreshing} onRefresh={versions.refresh} tintColor={colors.primary} />
      }
    >
      <StatusMessage message={versions.error} />
      {list.length === 0 ? <EmptyState title="Sin versiones" /> : null}
      {list.map((v, i) => (
        <VersionCard key={v.id} subjectId={subjectId} version={v} current={i === 0} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
});
