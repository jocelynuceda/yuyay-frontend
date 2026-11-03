import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Fondo degradado suave (crema → celeste agua) con manchas de color. */
export function AuroraBackground({ children }: { children: ReactNode }) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.soft, colors.surface, colors.white]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.blobLayer} pointerEvents="none">
        <View style={[styles.blob, styles.blobPink]} />
        <View style={[styles.blob, styles.blobAlmond]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  // Capa propia para que las manchas que sobresalen no desplacen el contenido
  blobLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.55 },
  blobPink: { width: 320, height: 320, top: -120, left: -100, backgroundColor: colors.soft },
  blobAlmond: { width: 260, height: 260, bottom: -80, right: -90, backgroundColor: colors.soft },
});
