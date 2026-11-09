import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useColorScheme, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
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
  const value = useMemo(() => ({ theme: dark ? darkTheme : lightTheme, preference, setPreference, ready }), [dark, preference, setPreference, ready]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
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
