import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getAccessLogs, getCareRelationships, getDelegations } from '../services/api';
import { colors, fonts } from '../theme';
import type { AccessLog, HomeStackParamList } from '../types';
import { accessActionMeta, accessTargetLabel } from '../utils/accessLog';
import { formatDateTime, timeAgo } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'AccessLog'>;

/** Trae la bitácora junto con los nombres de cuidadores y delegados, que el backend entrega solo como id. */
async function loadLogs(subjectId: number) {
  const [logs, relationships, delegations] = await Promise.all([
    getAccessLogs(subjectId),
    getCareRelationships(subjectId),
    getDelegations(subjectId),
  ]);
  const users = new Map(relationships.map((r) => [r.user.id, r.user.name]));
  const delegates = new Map(delegations.map((d) => [d.id, d.granteeName]));
  return { logs, users, delegates };
}

function actorOf(log: AccessLog, users: Map<number, string>, delegates: Map<number, string>) {
  if (log.visitorName) return log.visitorRole ? `${log.visitorName} (${log.visitorRole})` : log.visitorName;
  if (log.userId !== null) return users.get(log.userId) ?? 'Un cuidador';
  if (log.delegationId !== null) return delegates.get(log.delegationId) ?? 'Un delegado';
  return 'Alguien';
}

export function AccessLogScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const data = useFetch(() => loadLogs(subjectId), [subjectId]);
  useRefreshOnFocus(data.reload);

  if (data.loading && !data.data) return <LoadingView />;

  const logs = [...(data.data?.logs ?? [])].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.intro}>Quién vio, creó o modificó la información de esta persona.</Text>
      <StatusMessage message={data.error} />
      {logs.length === 0 ? <EmptyState title="Sin movimientos" /> : null}
      {logs.map((log) => {
        const meta = accessActionMeta[log.action];
        const actor = actorOf(log, data.data!.users, data.data!.delegates);
        return (
          <ListItem
            key={log.id}
            icon={meta.icon}
            iconBg={colors.accentTint}
            iconFg={colors.accentText}
            title={`${actor} ${meta.verb} ${accessTargetLabel(log)}`}
            subtitle={`${formatDateTime(log.occurredAt)} · ${timeAgo(log.occurredAt)}`}
            onPress={() => navigation.navigate('AccessLogDetail', { subjectId, log, actor })}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
});
