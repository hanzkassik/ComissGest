import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const switchesTo = theme === 'dark' ? 'claro' : 'escuro'
  const Icon = theme === 'dark' ? Sun : Moon

  return (
    <button
      className="quiet-button theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Ativar modo ${switchesTo}`}
      aria-pressed={theme === 'dark'}
      title={`Ativar modo ${switchesTo}`}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
    </button>
  )
}
