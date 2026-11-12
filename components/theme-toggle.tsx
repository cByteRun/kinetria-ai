'use client'
import { Moon, Sun } from 'lucide-react'
import { useTransition } from 'react'
import { setTheme } from '../i18n/actions'
import type { Theme } from '../i18n/settings'

export function ThemeToggle({ theme }: { theme: Theme }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      disabled={pending}
      aria-label={
        theme === 'light'
          ? 'Включить тёмную тему'
          : 'Включить светлую тему'
      }
      onClick={() =>
        start(() => setTheme(theme === 'light' ? 'dark' : 'light'))
      }
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
