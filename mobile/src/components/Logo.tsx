import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Sparkle } from './Sparkle';

export function Logo({ light = false, size = 'md' }: { light?: boolean; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.badge,
          big && styles.badgeLg,
          { backgroundColor: light ? 'rgba(255,255,255,0.12)' : colors.ink },
        ]}
      >
        <Sparkle size={big ? 30 : 18} color={colors.soft} />
      </View>
      <Text style={[styles.text, big && styles.textLg, { color: light ? colors.white : colors.ink }]}>
        Yuyay
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badgeLg: { width: 56, height: 56, borderRadius: 18 },
  text: { fontFamily: fonts.display, fontSize: 24 },
  textLg: { fontSize: 36 },
});
