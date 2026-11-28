import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';
import { isActivationKey } from '../utils/keyboard';
import { LionAvatar, type AvatarChoice } from './LionAvatar';
import { Sparkle } from './Sparkle';

export type ProfileStat = { icon: keyof typeof Ionicons.glyphMap; value: string; label: string };

/** Tarjeta de perfil: banner con degradado, avatar superpuesto, nombre y fila de datos. */
export function ProfileCard({
  name,
  subtitle,
  avatar,
  onAvatarPress,
  chip,
  stats,
  children,
}: {
  name: string;
  subtitle: string;
  avatar: AvatarChoice;
  /** Si se indica, el avatar es un botón (con un lápiz) para cambiarlo. */
  onAvatarPress?: () => void;
  chip?: string;
  stats: ProfileStat[];
  children?: ReactNode;
}) {
  const styles = useStyles();
  const { gradients, colors } = useTheme();
  return (
    <View style={styles.card}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerStar} pointerEvents="none">
          <Sparkle size={130} color="rgba(255,255,255,0.16)" />
        </View>
        <View style={styles.bannerStarSmall} pointerEvents="none">
          <Sparkle size={16} color="rgba(255,255,255,0.75)" />
        </View>
      </LinearGradient>

      <Pressable
        style={styles.avatarWrap}
        onPress={onAvatarPress}
        disabled={!onAvatarPress}
        accessibilityRole={onAvatarPress ? 'button' : undefined}
        accessibilityLabel={onAvatarPress ? 'Cambiar avatar' : undefined}
      >
        <View style={styles.avatar}>
          <LionAvatar kind={avatar.kind} variant={avatar.variant} size={86} animated />
        </View>
        {onAvatarPress ? (
          <View style={styles.avatarEdit}>
            <Ionicons name="pencil" size={14} color={colors.onInk} />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.identity}>
        <View style={styles.flex}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {chip ? (
          <View style={styles.chip}>
            <Text style={styles.chipText}>{chip}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.stats}>
        {stats.map((s) => (
          <View key={s.label} style={styles.stat}>
            <View style={styles.statTop}>
              <Ionicons name={s.icon} size={18} color={colors.ink} />
              <Text style={styles.statValue}>{s.value}</Text>
            </View>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {children}
    </View>
  );
}

// Tiempo para llenar la barra
const HOLD_MS = 700;
const RELEASE_MS = 200;

/** Botón ancho tipo píldora: se mantiene presionado y una barra lo llena de izquierda a derecha; al completarse, confirma. */
export function PillAction({
  label,
  icon = 'add',
  onPress,
  onHoldChange,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Avisa mientras se mantiene presionado, para que un contenedor deslizable no cambie de página. */
  onHoldChange?: (holding: boolean) => void;
}) {
  const styles = useStyles();
  const { gradients, colors } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const done = useRef(false);

  // Abre sin esperar a que se llene la barra (teclado y lector de pantalla)
  function openNow() {
    done.current = true;
    progress.stopAnimation();
    progress.setValue(0);
    onHoldChange?.(false);
    onPress();
  }

  return (
    <Pressable
      onPressIn={() => {
        done.current = false;
        onHoldChange?.(true);
        // Retoma desde donde quedó si se vuelve a presionar
        progress.stopAnimation((value) => {
          Animated.timing(progress, {
            toValue: 1,
            duration: HOLD_MS * (1 - value),
            easing: Easing.linear,
            useNativeDriver: false,
          }).start(({ finished }) => {
            if (finished && !done.current) {
              done.current = true;
              onHoldChange?.(false);
              onPress();
              setTimeout(() => progress.setValue(0), 400);
            }
          });
        });
      }}
      // Soltar antes de llenarse cancela. Pressable también llama onPressOut si el dedo sale
      // del botón o si un ScrollView toma el gesto, así que esos casos también cancelan
      onPressOut={() => {
        if (done.current) return;
        onHoldChange?.(false);
        progress.stopAnimation();
        Animated.timing(progress, { toValue: 0, duration: RELEASE_MS, useNativeDriver: false }).start();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Mantén presionado para continuar"
      accessibilityActions={[{ name: 'activate' }]}
      // Con lector de pantalla, el doble toque abre directo sin mantener
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate') onPress();
      }}
      // En la web, Enter o Espacio abren directo, como el doble toque del lector de pantalla
      onKeyDown={(e: { nativeEvent: { key?: string; repeat?: boolean }; preventDefault?: () => void }) => {
        if (!isActivationKey(e.nativeEvent)) return;
        e.preventDefault?.();
        openNow();
      }}
    >
      <LinearGradient
        colors={gradients.dark}
        locations={[0, 0.7, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.pill}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.pillFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
        <View style={styles.pillRow}>
          <Ionicons name={icon} size={20} color={colors.white} />
          <Text style={styles.pillLabel}>{label}</Text>
        </View>
        <Text style={styles.pillHint}>Mantén presionado</Text>
      </LinearGradient>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, shadow }) => ({
  flex: { flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: 14,
    ...shadow,
    shadowOpacity: 0.07,
    elevation: 3,
  },
  banner: { height: 112, borderRadius: radius.lg, overflow: 'hidden' },
  bannerStar: { position: 'absolute', right: -20, top: -24 },
  bannerStarSmall: { position: 'absolute', right: 120, bottom: 22 },
  avatarWrap: { alignSelf: 'flex-start', marginTop: -52, marginLeft: 12 },
  avatarEdit: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.soft,
    borderWidth: 5,
    borderColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, paddingHorizontal: 6 },
  name: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted, marginTop: 2 },
  chip: { backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.onInk },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16, marginHorizontal: 6 },
  stats: { flexDirection: 'row', paddingHorizontal: 6, marginBottom: 6 },
  stat: { flex: 1, alignItems: 'center' },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { fontFamily: fonts.semibold, fontSize: 24, color: colors.ink },
  statLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4 },
  pill: {
    height: 62,
    borderRadius: radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.22)' },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pillLabel: { fontFamily: fonts.semibold, fontSize: 17, color: colors.white },
  // Legible también sobre la barra llena (contraste AA)
  pillHint: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
}));
