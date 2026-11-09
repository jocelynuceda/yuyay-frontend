import { Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/** Mensaje de error o de información dentro de un formulario o pantalla. */
export function StatusMessage({ message, tone = 'error' }: { message?: string | null; tone?: 'error' | 'info' }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!message) return null;
  const isError = tone === 'error';
  return (
    <View style={[styles.box, isError ? styles.error : styles.info]} accessibilityRole="alert">
      <Text style={[styles.text, { color: isError ? colors.danger : colors.softText }]}>{message}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  box: { borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12 },
  error: { backgroundColor: colors.dangerBg },
  info: { backgroundColor: colors.soft },
  text: { fontFamily: fonts.medium, fontSize: 14 },
}));
