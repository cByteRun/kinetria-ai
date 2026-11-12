'use client'
import { useTranslations } from 'next-intl'
import { Moon, Sun } from 'lucide-react'
import { useTransition } from 'react'
import { setTheme } from '../i18n/actions'
import type { Theme } from '../i18n/settings'

export function ThemeToggle({ theme }: { theme: Theme }) {
  const ui = useTranslations('ui')

  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      disabled={pending}
      aria-label={
        theme === 'light' ? ui('switchToDarkTheme') : ui('switchToLightTheme')
      }
      onClick={() =>
        start(() => setTheme(theme === 'light' ? 'dark' : 'light'))
      }
    >
      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  )
}
