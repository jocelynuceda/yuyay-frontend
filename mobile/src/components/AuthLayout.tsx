import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gradients, heroIsDark, radius, shadow } from '../theme';
import { FormScroll } from './FormScroll';
import { Logo } from './Logo';
import { Sparkle } from './Sparkle';
import { SparkleBuddy } from './SparkleBuddy';

export type AuthMode = 'login' | 'register';

const modes: { key: AuthMode; label: string }[] = [
  { key: 'login', label: 'Iniciar sesión' },
  { key: 'register', label: 'Crear cuenta' },
];

/** Estructura compartida por Login y Registro: cabecera con degradado, selector y tarjeta con el formulario. */
export function AuthLayout({
  mode,
  onSwitchMode,
  title,
  subtitle,
  footer,
  children,
}: {
  mode: AuthMode;
  onSwitchMode: (mode: AuthMode) => void;
  title: string;
  subtitle: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.flex}>
      <FormScroll
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + 16 }]}
        >
          {/* Estrellas decorativas de fondo */}
          <View style={styles.decoLayer} pointerEvents="none">
            <View style={[styles.deco, { top: insets.top + 54, right: 28 }]}>
              <Sparkle size={18} color="rgba(255,255,255,0.7)" />
            </View>
            <View style={[styles.deco, { bottom: 86, right: 132 }]}>
              <Sparkle size={12} color={colors.cream} />
            </View>
            <View style={[styles.glow, { top: -60, left: -40 }]} />
          </View>

          <Logo light={heroIsDark} />

          <View style={styles.heroRow}>
            <View style={styles.heroText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <SparkleBuddy size={128} />
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.segment} accessibilityRole="tablist">
            {modes.map((m) => {
              const active = m.key === mode;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => !active && onSwitchMode(m.key)}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.form}>{children}</View>
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </FormScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  scroll: { flexGrow: 1 },
  hero: {
    minHeight: 380,
    paddingHorizontal: 24,
    paddingBottom: 72,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  decoLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  deco: { position: 'absolute' },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroRow: { flex: 1, flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  heroText: { flex: 1, paddingRight: 8 },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.onHero },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.onHeroSoft,
    marginTop: 8,
  },
  card: {
    marginTop: -48,
    marginHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 20,
    ...shadow,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
  },
  segmentItem: { flex: 1, paddingVertical: 11, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.white, ...shadow, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  segmentText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  segmentTextActive: { color: colors.primary },
  form: { marginTop: 20, gap: 6 },
  // marginTop automático: el pie queda abajo en pantallas altas
  footer: { marginTop: 'auto', paddingTop: 24, paddingHorizontal: 24, alignItems: 'center' },
});
