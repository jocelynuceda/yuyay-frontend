import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, type ImageSourcePropType } from 'react-native';

export type LionKind = 'adult' | 'cub' | 'elder';
export type LionVariant = 'lion' | 'lioness';
export type AvatarChoice = { kind: LionKind; variant: LionVariant };
export type AvatarId = `${LionKind}-${LionVariant}`;

type Art = Record<LionVariant, ImageSourcePropType>;

/** Recorte de la cabeza (assets/lions/*-face.png), para los avatares circulares. */
const faces: Record<LionKind, Art> = {
  cub: { lion: require('../../assets/lions/cub-lion-face.png'), lioness: require('../../assets/lions/cub-lioness-face.png') },
  adult: { lion: require('../../assets/lions/adult-lion-face.png'), lioness: require('../../assets/lions/adult-lioness-face.png') },
  elder: { lion: require('../../assets/lions/elder-lion-face.png'), lioness: require('../../assets/lions/elder-lioness-face.png') },
};

/** Cuerpo completo, para pantallas vacías, la bienvenida, etc. */
export const lionIllustrations: Record<LionKind, Art> = {
  cub: { lion: require('../../assets/lions/cub-lion.png'), lioness: require('../../assets/lions/cub-lioness.png') },
  adult: { lion: require('../../assets/lions/adult-lion.png'), lioness: require('../../assets/lions/adult-lioness.png') },
  elder: { lion: require('../../assets/lions/elder-lion.png'), lioness: require('../../assets/lions/elder-lioness.png') },
};

const labels: Record<LionKind, Record<LionVariant, string>> = {
  cub: { lion: 'Leoncito', lioness: 'Leoncita' },
  adult: { lion: 'León', lioness: 'Leona' },
  elder: { lion: 'León abuelo', lioness: 'Leona abuela' },
};

/** Cachorro si es menor de edad, león viejo desde los 60 y adulto en los demás casos (o sin edad). */
export function lionForAge(age: number | null): LionKind {
  if (age === null) return 'adult';
  if (age < 18) return 'cub';
  if (age >= 60) return 'elder';
  return 'adult';
}

export const avatarId = ({ kind, variant }: AvatarChoice): AvatarId => `${kind}-${variant}`;

/** Opciones del selector, de menor a mayor edad. */
export const avatarOptions: (AvatarChoice & { id: AvatarId; label: string })[] = (['cub', 'adult', 'elder'] as const).flatMap(
  (kind) => (['lion', 'lioness'] as const).map((variant) => ({ kind, variant, id: avatarId({ kind, variant }), label: labels[kind][variant] })),
);

export function parseAvatarId(value: string | null | undefined): AvatarChoice | null {
  const option = avatarOptions.find((o) => o.id === value);
  return option ? { kind: option.kind, variant: option.variant } : null;
}

/** Avatar automático: la edad elige el león y el id alterna león y leona (el backend no guarda el sexo). */
export const defaultAvatar = (age: number | null, id?: number): AvatarChoice => ({
  kind: lionForAge(age),
  variant: id !== undefined && id % 2 === 1 ? 'lioness' : 'lion',
});

/**
 * Avatar de león. `animated` agrega una respiración suave;
 * se desactiva si el sistema pide reducir el movimiento.
 */
export function LionAvatar({
  kind,
  variant = 'lion',
  size = 48,
  animated = false,
}: {
  kind: LionKind;
  variant?: LionVariant;
  size?: number;
  animated?: boolean;
}) {
  const [breath] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const moving = animated && !reduceMotion;

  useEffect(() => {
    if (!moving) return;
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    breathing.start();
    return () => {
      breathing.stop();
      breath.setValue(0);
    };
  }, [moving, breath]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });

  return (
    <Animated.View
      style={{ width: size, height: size, transform: [{ scale }] }}
      accessibilityRole="image"
      accessibilityLabel={labels[kind][variant]}
    >
      <Image source={faces[kind][variant]} style={{ width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}
