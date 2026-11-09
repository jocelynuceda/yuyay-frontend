import { ActivityIndicator, Text, View } from 'react-native';
import { fonts, makeStyles, useTheme } from '../theme';

export function LoadingView({ label = 'Cargando…' }: { label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  label: { fontFamily: fonts.medium, color: colors.muted },
}));
