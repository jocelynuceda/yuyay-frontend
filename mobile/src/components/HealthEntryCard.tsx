import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HealthEntry } from '../types';
import { colors, fonts, radius, shadow } from '../theme';
import { categoryMeta, fallbackCategory } from '../utils/categories';
import { formatDate } from '../utils/format';
import { Badge } from './Badge';

export function HealthEntryCard({ entry, onPress }: { entry: HealthEntry; onPress?: () => void }) {
  const v = entry.latestVersion;
  const tone = categoryMeta[entry.categoryCode] ?? fallbackCategory;
  const facts = [v.dose && `Dosis: ${v.dose}`, v.frequency && v.frequency].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityHint={onPress ? 'Abre el historial del registro' : undefined}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Ionicons name={tone.icon} size={20} color={tone.fg} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.category}>{entry.categoryName.toUpperCase()}</Text>
          <Text style={styles.title}>{v.title}</Text>
        </View>
        <Badge
          label={v.confidenceLevel === 'CONFIRMED' ? 'Confirmado' : 'Por confirmar'}
          tone={v.confidenceLevel === 'CONFIRMED' ? 'accent' : 'amber'}
        />
      </View>
      {facts ? <Text style={styles.facts}>{facts}</Text> : null}
      {v.details ? <Text style={styles.details}>{v.details}</Text> : null}
      <Text style={styles.footer}>
        v{v.versionNumber} · {v.declaredBy.name} · {formatDate(v.declaredAt)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 12,
    ...shadow,
    shadowOpacity: 0.06,
  },
  pressed: { opacity: 0.85 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  category: { fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, letterSpacing: 0.6 },
  title: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, marginTop: 2 },
  facts: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  details: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 10, lineHeight: 20 },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
