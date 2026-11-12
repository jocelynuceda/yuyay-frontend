import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { fonts, makeStyles, radius, useTheme } from '../theme';
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

/** Botón ancho tipo píldora: se desliza el círculo blanco hasta el final para confirmar. */
export function PillAction({
  label,
  icon = 'arrow-forward',
  onPress,
  onDragChange,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** Avisa mientras se arrastra, para que un contenedor deslizable no le quite el gesto. */
  onDragChange?: (dragging: boolean) => void;
}) {
  const styles = useStyles();
  const { gradients, colors } = useTheme();
  const [x] = useState(() => new Animated.Value(0));
  const max = useRef(0);
  const startX = useRef(0);

  function finish(dx: number) {
    onDragChange?.(false);
    if (dx >= max.current * 0.8) {
      Animated.timing(x, { toValue: max.current, duration: 120, useNativeDriver: false }).start(() => {
        onPress();
        setTimeout(() => x.setValue(0), 400);
      });
    } else {
      Animated.spring(x, { toValue: 0, useNativeDriver: false, bounciness: 8 }).start();
    }
  }

  const labelOpacity = x.interpolate({ inputRange: [0, 120], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <View
      onLayout={(e) => {
        // Recorrido: ancho total menos el círculo (46) y el margen interno (8 a cada lado)
        max.current = Math.max(e.nativeEvent.layout.width - 46 - 16, 0);
      }}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Desliza hacia la derecha para continuar"
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={() => onPress()}
    >
      <LinearGradient
        colors={gradients.dark}
        locations={[0, 0.7, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.pill}
      >
        <Animated.Text style={[styles.pillLabel, { opacity: labelOpacity }]}>{label}</Animated.Text>
        <Animated.View style={[styles.pillHint, { opacity: labelOpacity }]}>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.6)" />
        </Animated.View>
        <Animated.View
          style={[styles.pillIcon, { transform: [{ translateX: x }] }]}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          // Que el scroll vertical no le quite el gesto a mitad del arrastre
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => {
            startX.current = e.nativeEvent.pageX;
            onDragChange?.(true);
          }}
          onResponderMove={(e) => {
            const dx = e.nativeEvent.pageX - startX.current;
            x.setValue(Math.min(Math.max(dx, 0), max.current));
          }}
          onResponderRelease={(e) => finish(e.nativeEvent.pageX - startX.current)}
          onResponderTerminate={() => finish(0)}
        >
          <Ionicons name={icon} size={22} color={colors.ink} />
        </Animated.View>
      </LinearGradient>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  pillIcon: {
    position: 'absolute',
    left: 8,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17, color: colors.white },
  pillHint: { position: 'absolute', right: 20, flexDirection: 'row' },
}));
