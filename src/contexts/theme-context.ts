import { createContext } from 'react'

export type Theme = 'light' | 'dark'
type ThemePreference = Theme | 'system'

export interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

export type { ThemePreference }
export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
