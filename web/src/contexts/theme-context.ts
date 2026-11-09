import { createContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeApi {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeApi>({
  preference: 'system',
  resolved: 'light',
  setPreference: () => {},
  toggle: () => {},
})
