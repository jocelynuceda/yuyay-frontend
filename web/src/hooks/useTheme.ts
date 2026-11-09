import { useContext } from 'react'
import { ThemeContext, type ThemeApi } from '../contexts/theme-context'

/** Preferencia y tema resuelto, con `setPreference` y `toggle` (claro u oscuro). Sin ThemeProvider queda en claro y no cambia nada. */
export function useTheme(): ThemeApi {
  return useContext(ThemeContext)
}
