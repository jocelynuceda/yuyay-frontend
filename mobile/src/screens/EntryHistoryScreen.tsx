import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { Badge, type BadgeTone } from '../components/Badge';
import { HealthEntryCard } from '../components/HealthEntryCard';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { useFetch } from '../hooks/useFetch';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { getHealthEntry, getHealthEntryVersions } from '../services/api';
import { colors, fonts, radius, shadow } from '../theme';
import type { ChangeType, HealthEntryVersion, HomeStackParamList } from '../types';
import { formatDate } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'EntryHistory'>;

type Field = 'title' | 'details' | 'dose' | 'frequency' | 'occurredOn' | 'confidenceLevel' | 'notes';

const fieldLabels: Record<Field, string> = {
  title: 'Título',
  details: 'Detalles',
  dose: 'Dosis',
  frequency: 'Frecuencia',
  occurredOn: 'Fecha',
  confidenceLevel: 'Certeza',
  notes: 'Notas',
};

const changeLabels: Record<ChangeType, { label: string; tone: BadgeTone }> = {
  CREATED: { label: 'Creado', tone: 'primary' },
  UPDATED: { label: 'Editado', tone: 'accent' },
  DELETED: { label: 'Eliminado', tone: 'amber' },
};

const dateTime = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function display(field: Field, v: HealthEntryVersion) {
  const value = v[field];
  if (!value) return '—';
  if (field === 'confidenceLevel') return value === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar';
  if (field === 'occurredOn') return formatDate(value);
  return value;
}

/** Campos que cambiaron respecto de la versión anterior. */
function changedFields(current: HealthEntryVersion, previous: HealthEntryVersion) {
  return (Object.keys(fieldLabels) as Field[]).filter((f) => (current[f] ?? null) !== (previous[f] ?? null));
}

/** Versión actual del registro y todas sus versiones, con quién y cuándo. */
export function EntryHistoryScreen({ route, navigation }: Props) {
  const { subjectId, entryId } = route.params;
  const entry = useFetch(() => getHealthEntry(subjectId, entryId), [subjectId, entryId]);
  const versions = useFetch(() => getHealthEntryVersions(subjectId, entryId), [subjectId, entryId]);
  useRefreshOnFocus(() => {
    entry.reload();
    versions.reload();
  });

  const editable = !!entry.data && !entry.data.deletedAt;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: editable
        ? () => (
            <Button compact onPress={() => navigation.navigate('EditEntry', { subjectId, entryId })}>
              Editar
            </Button>
          )
        : undefined,
    });
  }, [navigation, editable, subjectId, entryId]);

  if (entry.loading && !entry.data) return <LoadingView />;
  if (!entry.data) return <StatusMessage message={entry.error ?? 'No encontramos este registro.'} />;

  const list = versions.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={versions.refreshing}
          onRefresh={() => {
            entry.reload();
            versions.refresh();
          }}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.section}>Versión actual</Text>
      <HealthEntryCard entry={entry.data} />

      <Text style={styles.section}>Historial</Text>
      <StatusMessage message={versions.error} />
      {versions.loading && !versions.data ? <LoadingView label="Cargando versiones…" /> : null}

      {list.map((v, index) => {
        const previous = list[index + 1];
        const change = changeLabels[v.changeType] ?? changeLabels.UPDATED;
        const fields = previous && v.changeType === 'UPDATED' ? changedFields(v, previous) : [];
        return (
          <View key={v.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.version}>Versión {v.versionNumber}</Text>
              <Badge label={change.label} tone={change.tone} />
            </View>
            <Text style={styles.meta}>
              {v.declaredBy.name} · {dateTime.format(new Date(v.declaredAt))}
            </Text>

            {v.changeType === 'CREATED' ? <Text style={styles.change}>{v.title}</Text> : null}
            {fields.map((f) => (
              <Text key={f} style={styles.change}>
                <Text style={styles.field}>{fieldLabels[f]}: </Text>
                <Text style={styles.old}>{display(f, previous)}</Text>
                {'  →  '}
                {display(f, v)}
              </Text>
            ))}
            {v.changeType === 'UPDATED' && previous && fields.length === 0 ? (
              <Text style={styles.meta}>Se guardó sin cambios en los campos.</Text>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 40 },
  section: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 8, marginBottom: 10 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    gap: 6,
    ...shadow,
    shadowOpacity: 0.06,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  version: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  change: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.ink },
  field: { fontFamily: fonts.semibold },
  old: { color: colors.muted, textDecorationLine: 'line-through' },
});
