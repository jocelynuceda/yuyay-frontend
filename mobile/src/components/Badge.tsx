import { StyleSheet, Text, View } from 'react-native';
import { fonts, useTheme, type Colors } from '../theme';

const tonesFor = (colors: Colors) => ({
  primary: { bg: colors.soft, fg: colors.softText },
  accent: { bg: colors.accentTint, fg: colors.accentText },
  soft: { bg: colors.soft, fg: colors.softText },
  ink: { bg: colors.ink, fg: colors.onInk },
  amber: { bg: colors.amberBg, fg: colors.amberText },
  light: { bg: colors.glass, fg: colors.ink },
});

export type BadgeTone = keyof ReturnType<typeof tonesFor>;

export function Badge({ label, tone = 'primary' }: { label: string; tone?: BadgeTone }) {
  const tones = tonesFor(useTheme().colors);
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone].bg }]}>
      <Text style={[styles.text, { color: tones[tone].fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontFamily: fonts.semibold, fontSize: 12 },
});
