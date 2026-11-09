import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

const tones = {
  primary: { bg: colors.soft, fg: colors.softText },
  accent: { bg: colors.accentTint, fg: colors.accentText },
  soft: { bg: colors.soft, fg: colors.softText },
  ink: { bg: colors.ink, fg: colors.white },
  amber: { bg: colors.amberBg, fg: colors.amberText },
  light: { bg: 'rgba(255,255,255,0.7)', fg: colors.ink },
};

export type BadgeTone = keyof typeof tones;

export function Badge({ label, tone = 'primary' }: { label: string; tone?: BadgeTone }) {
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
