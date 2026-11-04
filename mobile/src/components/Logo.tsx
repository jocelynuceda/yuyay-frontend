import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';
import { Isotipo } from './Isotipo';

export function Logo({ light = false, size = 'md' }: { light?: boolean; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  const color = light ? colors.white : colors.ink;
  return (
    <View style={styles.row}>
      <Isotipo size={big ? 60 : 40} color={color} />
      <Text style={[styles.text, big && styles.textLg, { color }]}>Yuyay</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { fontFamily: fonts.display, fontSize: 24 },
  textLg: { fontSize: 36 },
});
