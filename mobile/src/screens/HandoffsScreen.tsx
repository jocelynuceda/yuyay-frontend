import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { EmptyState } from '../components/EmptyState';
import { SubmitButton } from '../components/FormKit';
import { ListItem } from '../components/ListItem';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getHandoffs } from '../services/api';
import { colors, fonts } from '../theme';
import type { HomeStackParamList } from '../types';
import { formatDate } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'Handoffs'>;

export function HandoffsScreen({ route, navigation }: Props) {
  const { subjectId } = route.params;
  const handoffs = useFetch(() => getHandoffs(subjectId), [subjectId]);
  useRefreshOnFocus(handoffs.reload);

  if (handoffs.loading && !handoffs.data) return <LoadingView />;

  const list = [...(handoffs.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={handoffs.refreshing} onRefresh={handoffs.refresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.intro}>
        Elige qué registros llevar a una consulta o urgencia y muéstralos al médico desde el celular.
      </Text>

      <SubmitButton
        label="Nuevo resumen"
        icon="clipboard-plus-outline"
        onPress={() => navigation.navigate('NewHandoff', { subjectId })}
      />

      <StatusMessage message={handoffs.error} />

      {list.length > 0 ? <Text style={styles.section}>Historial</Text> : null}
      {list.length === 0 ? (
        <EmptyState title="Aún no hay resúmenes" description="Los resúmenes que crees aparecerán aquí." />
      ) : (
        list.map((h) => (
          <ListItem
            key={h.id}
            icon="clipboard-outline"
            iconBg={colors.accentTint}
            iconFg={colors.accentText}
            title={h.reason}
            subtitle={formatDate(h.createdAt)}
            onPress={() => navigation.navigate('HandoffView', { handoffId: h.id })}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  section: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 8 },
});
