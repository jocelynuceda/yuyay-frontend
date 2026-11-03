import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/** Aparece subiendo suavemente; `delay` permite escalonar varias tarjetas. */
export function FadeIn({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 480,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Pressable que se encoge un poco al tocarlo y rebota al soltarlo. */
export function PressableScale({
  style,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const [scale] = useState(() => new Animated.Value(1));
  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <Pressable {...rest} onPressIn={() => springTo(0.96)} onPressOut={() => springTo(1)}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Flota arriba y abajo en bucle, con un leve giro: para la mascota. */
export function Floating({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [t] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
            { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
