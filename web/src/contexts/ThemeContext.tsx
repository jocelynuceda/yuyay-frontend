import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ThemeContext, type ResolvedTheme, type ThemeApi, type ThemePreference } from './theme-context'

const STORAGE_KEY = 'yuyay.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function writePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Sin almacenamiento disponible: la preferencia vale solo para esta sesión
  }
}

function subscribeSystemDark(onChange: () => void) {
  if (typeof matchMedia !== 'function') return () => {}
  const query = matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const systemPrefersDark = () => typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches

/** Provee `useTheme()`: preferencia guardada (claro, oscuro o sistema) y tema resuelto aplicado a <html>. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference)
  const systemDark = useSyncExternalStore(subscribeSystemDark, systemPrefersDark, () => false)
  const resolved: ResolvedTheme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [resolved])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    writePreference(next)
  }, [])

  const toggle = useCallback(
    () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
    [resolved, setPreference],
  )

  const api = useMemo<ThemeApi>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  )

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}
