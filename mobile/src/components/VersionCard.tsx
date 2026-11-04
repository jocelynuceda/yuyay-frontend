import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow } from '../theme';
import type { ChangeType, HealthEntryVersion } from '../types';
import { formatDateTime } from '../utils/format';
import { Badge, type BadgeTone } from './Badge';

const changeLabel: Record<ChangeType, { label: string; tone: BadgeTone }> = {
  CREATED: { label: 'Creado', tone: 'accent' },
  UPDATED: { label: 'Editado', tone: 'amber' },
  DELETED: { label: 'Borrado', tone: 'soft' },
};

/** Una versión de un registro de salud: qué decía, quién lo declaró y cuándo. */
export function VersionCard({ version: v, current }: { version: HealthEntryVersion; current?: boolean }) {
  const change = changeLabel[v.changeType];
  const facts = [v.dose && `Dosis: ${v.dose}`, v.frequency].filter(Boolean).join(' · ');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{v.title}</Text>
        <Badge label={change.label} tone={change.tone} />
      </View>
      {facts ? <Text style={styles.facts}>{facts}</Text> : null}
      {v.details ? <Text style={styles.text}>{v.details}</Text> : null}
      {v.notes ? <Text style={styles.text}>Nota: {v.notes}</Text> : null}
      {v.confidenceLevel === 'UNCERTAIN' ? <Badge label="Por confirmar" tone="amber" /> : null}
      <Text style={styles.footer}>
        v{v.versionNumber}
        {current ? ' (actual)' : ''} · {v.declaredBy.name} · {formatDateTime(v.declaredAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    gap: 8,
    ...shadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  facts: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
