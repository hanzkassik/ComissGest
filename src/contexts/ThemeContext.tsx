import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type Theme, type ThemePreference } from './theme-context'

function getInitialPreference(): ThemePreference {
  try {
    const savedPreference = window.localStorage.getItem('comissgest.theme')
    if (savedPreference === 'light' || savedPreference === 'dark') return savedPreference
  } catch {
    // Theme still follows the operating system when browser storage is unavailable.
  }
  return 'system'
}

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(getInitialPreference)
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme)
  const theme = preference === 'system' ? systemTheme : preference

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemThemeChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    mediaQuery.addEventListener('change', onSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', onSystemThemeChange)
  }, [])

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      if (preference === 'system') window.localStorage.removeItem('comissgest.theme')
      else window.localStorage.setItem('comissgest.theme', preference)
    } catch {
      // Applying the current theme does not depend on browser storage.
    }
  }, [preference, theme])

  const value = useMemo(() => ({
    theme,
    toggleTheme: () => setPreference((current) => {
      const resolvedTheme = current === 'system' ? getSystemTheme() : current
      return resolvedTheme === 'dark' ? 'light' : 'dark'
    }),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
