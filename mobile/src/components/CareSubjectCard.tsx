import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';
import type { CareSubject } from '../types';
import { fonts, makeStyles, radius, useTheme, type Colors } from '../theme';
import { ageFrom, careRoleLabel } from '../utils/format';
import { Sparkle } from './Sparkle';

// Combinaciones de fondo y estrella tomadas de la paleta
const cardTonesFor = (colors: Colors) => [
  { bg: colors.peopleStar, star: colors.primary },
  { bg: colors.accent, star: colors.white },
  { bg: colors.primary, star: colors.accent },
  { bg: colors.cream, star: colors.accent },
  { bg: colors.ink, star: colors.accent },
];

export function CareSubjectCard({
  subject,
  index,
  onPress,
}: {
  subject: CareSubject;
  index: number;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const cardTones = cardTonesFor(colors);
  const tone = cardTones[index % cardTones.length];
  const age = ageFrom(subject.birthDate);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Ver registro de ${subject.name}`}
    >
      <View style={[styles.tile, { backgroundColor: tone.bg }]}>
        <Sparkle size={30} color={tone.star} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {subject.name}
        </Text>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{careRoleLabel[subject.myRole]}</Text>
          </View>
          <View style={[styles.chip, styles.chipMuted]}>
            <Text style={[styles.chipText, styles.chipTextMuted]}>
              {age !== null ? `${age} años` : 'Sin edad'}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.arrow}>
        <Ionicons name="chevron-forward" size={18} color={colors.ink} />
      </View>
    </TouchableOpacity>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 12,
    ...shadow,
    shadowOpacity: 0.06,
    elevation: 2,
  },
  tile: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 6 },
  name: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { backgroundColor: colors.soft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  chipMuted: { backgroundColor: colors.surface },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.softText },
  chipTextMuted: { color: colors.muted },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
