import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FormCard } from '../components/FormKit';
import { LoadingView } from '../components/LoadingView';
import { StatusMessage } from '../components/StatusMessage';
import { VersionCard } from '../components/VersionCard';
import { useFetch } from '../hooks/useFetch';
import { getDelegations, getEntryVersions, getHandoff } from '../services/api';
import { colors, fonts } from '../theme';
import type { AccessLog, ChangeType, Delegation, HandoffDetail, HealthEntryVersion, HomeStackParamList } from '../types';
import { accessActionMeta, accessTargetLabel } from '../utils/accessLog';
import { categoryMeta } from '../utils/categories';
import { formatDate } from '../utils/format';

type Props = NativeStackScreenProps<HomeStackParamList, 'AccessLogDetail'>;

const fullDateTime = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

const changeOf: Partial<Record<AccessLog['action'], ChangeType>> = {
  CREATE: 'CREATED',
  UPDATE: 'UPDATED',
  DELETE: 'DELETED',
};

const fieldLabels: { key: keyof HealthEntryVersion; label: string }[] = [
  { key: 'title', label: 'Título' },
  { key: 'dose', label: 'Dosis' },
  { key: 'frequency', label: 'Frecuencia' },
  { key: 'details', label: 'Detalles' },
  { key: 'occurredOn', label: 'Fecha' },
  { key: 'notes', label: 'Notas' },
  { key: 'confidenceLevel', label: 'Confianza' },
];

function showValue(key: keyof HealthEntryVersion, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Vacío';
  if (key === 'confidenceLevel') return value === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar';
  if (key === 'occurredOn') return formatDate(String(value));
  return String(value);
}

/** La bitácora no dice qué versión tocó: es la del mismo tipo de cambio guardada más cerca de ese momento. */
function versionAt(versions: HealthEntryVersion[], log: AccessLog) {
  const change = changeOf[log.action];
  const distance = (v: HealthEntryVersion) => Math.abs(Date.parse(v.declaredAt) - Date.parse(log.occurredAt));
  if (change) {
    return versions.filter((v) => v.changeType === change).sort((a, b) => distance(a) - distance(b))[0] ?? null;
  }
  // Una consulta muestra lo que había en ese momento: la última versión anterior
  const before = versions.filter((v) => Date.parse(v.declaredAt) <= Date.parse(log.occurredAt));
  return before.sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}

type Target =
  | { kind: 'entry'; version: HealthEntryVersion; previous: HealthEntryVersion | null }
  | { kind: 'handoff'; handoff: HandoffDetail }
  | { kind: 'delegation'; delegation: Delegation }
  | null;

/** Trae aquello sobre lo que se actuó. Si ya no existe, el detalle muestra solo el movimiento. */
async function loadTarget(subjectId: number, log: AccessLog): Promise<Target> {
  if (log.targetId === null) return null;
  const id = log.targetId;
  if (log.targetType === 'HEALTH_ENTRY') {
    const versions = await getEntryVersions(subjectId, id);
    const version = versionAt(versions, log);
    if (!version) return null;
    const previous = versions.find((v) => v.versionNumber === version.versionNumber - 1) ?? null;
    return { kind: 'entry', version, previous };
  }
  if (log.targetType === 'HANDOFF') {
    return getHandoff(id).then((handoff) => ({ kind: 'handoff', handoff }) as const, () => null);
  }
  if (log.targetType === 'DELEGATION') {
    const delegation = (await getDelegations(subjectId)).find((d) => d.id === id);
    return delegation ? { kind: 'delegation', delegation } : null;
  }
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function EntryChanges({ version, previous }: { version: HealthEntryVersion; previous: HealthEntryVersion }) {
  const changed = fieldLabels.filter(({ key }) => (version[key] ?? '') !== (previous[key] ?? ''));
  return (
    <FormCard title="Qué cambió">
      {changed.length === 0 ? <Text style={styles.value}>Se guardó sin cambios en los datos.</Text> : null}
      {changed.map(({ key, label }) => (
        <View key={key} style={styles.change}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.before}>{showValue(key, previous[key])}</Text>
          <View style={styles.afterRow}>
            <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            <Text style={styles.after}>{showValue(key, version[key])}</Text>
          </View>
        </View>
      ))}
    </FormCard>
  );
}

export function AccessLogDetailScreen({ route }: Props) {
  const { subjectId, log, actor } = route.params;
  const target = useFetch(() => loadTarget(subjectId, log), [subjectId, log.id]);
  const meta = accessActionMeta[log.action];

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <FormCard title={`${actor} ${meta.verb} ${accessTargetLabel(log)}`}>
        <Row label="Quién" value={actor} />
        <Row label="Fecha y hora" value={fullDateTime.format(new Date(log.occurredAt))} />
      </FormCard>

      <StatusMessage message={target.error} />
      {target.loading && !target.data ? <LoadingView /> : null}

      {target.data?.kind === 'entry' ? (
        <>
          {log.action === 'UPDATE' && target.data.previous ? (
            <EntryChanges version={target.data.version} previous={target.data.previous} />
          ) : null}
          <Text style={styles.section}>{log.action === 'UPDATE' ? 'Cómo quedó' : 'Registro'}</Text>
          <VersionCard subjectId={subjectId} version={target.data.version} />
        </>
      ) : null}

      {target.data?.kind === 'handoff' ? (
        <FormCard title="Resumen">
          <Row label="Motivo" value={target.data.handoff.reason} />
          <Row label="Registros incluidos" value={String(target.data.handoff.items.length)} />
        </FormCard>
      ) : null}

      {target.data?.kind === 'delegation' ? (
        <FormCard title="Acceso delegado">
          <Row label="Para" value={target.data.delegation.granteeName} />
          <Row
            label="Podía ver"
            value={target.data.delegation.categoryCodes.map((c) => categoryMeta[c]?.plural ?? c).join(', ')}
          />
          <Row label="Válido hasta" value={formatDate(target.data.delegation.validUntil)} />
        </FormCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, gap: 14, paddingBottom: 40 },
  section: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, marginTop: 4 },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginBottom: 2 },
  value: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  change: { gap: 2 },
  before: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  afterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  after: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: colors.ink },
});
