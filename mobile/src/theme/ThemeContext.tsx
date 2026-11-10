import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  useColorScheme,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { darkTheme, lightTheme, type Theme } from './themes';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'yuyay.theme';
const isPreference = (value: unknown): value is ThemePreference => value === 'system' || value === 'light' || value === 'dark';

const storage = {
  get: () => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(STORAGE_KEY) ?? null) : SecureStore.getItemAsync(STORAGE_KEY)),
  set: (value: string) =>
    Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(STORAGE_KEY, value)) : SecureStore.setItemAsync(STORAGE_KEY, value),
};

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** La preferencia guardada ya se leyó (evita un parpadeo del tema claro al abrir) */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: lightTheme, preference: 'system', setPreference: () => {}, ready: true });

/** Elige el tema claro u oscuro según la preferencia del usuario o, por defecto, la del sistema. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    storage
      .get()
      .then((stored) => {
        if (active && isPreference(stored)) setPreferenceState(stored);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    storage.set(next).catch(() => {});
  }, []);

  const dark = preference === 'system' ? system === 'dark' : preference === 'dark';
  const { shownDark, veil, veilColor } = useThemeTransition(dark, ready);
  const value = useMemo(
    () => ({ theme: shownDark ? darkTheme : lightTheme, preference, setPreference, ready }),
    [shownDark, preference, setPreference, ready],
  );
  return (
    <ThemeContext.Provider value={value}>
      <View style={styles.fill}>
        {children}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: veilColor, opacity: veil }]} />
      </View>
    </ThemeContext.Provider>
  );
}

const FADE_IN_MS = 180;
const FADE_OUT_MS = 320;

/**
 * Transición al cambiar de tema: un velo del color de fondo del tema nuevo cubre la pantalla, el tema cambia
 * mientras está cubierta y el velo se desvanece. Con "Reducir movimiento" (o al abrir la app) cambia al instante.
 */
function useThemeTransition(dark: boolean, ready: boolean) {
  const [shownDark, setShownDark] = useState(dark);
  const [veil] = useState(() => new Animated.Value(0));
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        reduceMotion.current = enabled;
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceMotion.current = enabled;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (dark === shownDark) return;
    // Antes de leer la preferencia guardada no hay nada que animar: es el tema inicial
    if (!ready || reduceMotion.current) {
      setShownDark(dark);
      return;
    }
    const native = Platform.OS !== 'web';
    veil.stopAnimation();
    Animated.timing(veil, { toValue: 1, duration: FADE_IN_MS, easing: Easing.out(Easing.quad), useNativeDriver: native }).start(
      ({ finished }) => {
        if (!finished) return;
        setShownDark(dark);
        Animated.timing(veil, {
          toValue: 0,
          duration: FADE_OUT_MS,
          delay: 40,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: native,
        }).start();
      },
    );
  }, [dark, ready, shownDark, veil]);

  return { shownDark, veil, veilColor: (dark ? darkTheme : lightTheme).colors.surface };
}

/** Tema en uso: colores, degradados, sombra y temas de Paper y navegación. */
export const useTheme = () => useContext(ThemeContext).theme;

/** Preferencia de apariencia (sistema, claro u oscuro) y cómo cambiarla. */
export function useThemePreference() {
  const { preference, setPreference, ready, theme } = useContext(ThemeContext);
  return { preference, setPreference, ready, dark: theme.dark };
}

/**
 * Crea un hook de estilos que depende del tema. Los estilos se calculan una vez por tema y se reutilizan.
 * Uso: `const useStyles = makeStyles(({ colors }) => ({ ... }))` y en el componente `const styles = useStyles()`.
 */
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(factory: (theme: Theme) => T & NamedStyles<any>) {
  const cache = new Map<Theme, T>();
  return function useStyles(): T {
    const theme = useTheme();
    const cached = cache.get(theme);
    if (cached) return cached;
    const styles: T = StyleSheet.create(factory(theme));
    cache.set(theme, styles);
    return styles;
  };
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
