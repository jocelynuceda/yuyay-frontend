import { Ionicons } from '@expo/vector-icons';
import { useNetworkState } from 'expo-network';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, makeStyles, radius, useTheme } from '../theme';

/** Aviso fijo en toda la app cuando el teléfono no tiene conexión a internet. */
export function OfflineBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { isConnected, isInternetReachable } = useNetworkState();
  const insets = useSafeAreaInsets();
  // Mientras el sistema no sabe el estado (undefined) no se muestra nada
  const offline = isConnected === false || isInternetReachable === false;
  if (!offline) return null;

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={18} color={colors.amberText} />
        <Text style={styles.text}>Sin conexión a internet. Revisa tu Wi-Fi o datos móviles.</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ shadow, colors }) => ({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  banner: {
    ...shadow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.amberBg,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: 480,
  },
  text: { flexShrink: 1, color: colors.amberText, fontFamily: fonts.semibold, fontSize: 13 },
}));
