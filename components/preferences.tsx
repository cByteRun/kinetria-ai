'use client'

import { Moon, Sun } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { setLocale, setTheme } from '../i18n/actions'
import { locales, type Theme } from '../i18n/settings'

export function Preferences({ theme }: { theme: Theme }) {
  const t = useTranslations('common')
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  return (
    <div className="preferences">
      <div
        role="group"
        aria-label={t('language')}
        className="preferences-group"
      >
        {locales.map((language) => (
          <button
            key={language}
            type="button"
            lang={language}
            aria-pressed={locale === language}
            aria-label={
              { ru: 'Русский', en: 'English', kk: 'Қазақша' }[language]
            }
            disabled={pending}
            onClick={() => startTransition(() => setLocale(language))}
          >
            {language.toUpperCase()}
          </button>
        ))}
      </div>
      <div role="group" aria-label={t('theme')} className="preferences-group">
        <button
          type="button"
          aria-label={t('light')}
          aria-pressed={theme === 'light'}
          disabled={pending}
          onClick={() => startTransition(() => setTheme('light'))}
        >
          <Sun size={16} />
        </button>
        <button
          type="button"
          aria-label={t('dark')}
          aria-pressed={theme === 'dark'}
          disabled={pending}
          onClick={() => startTransition(() => setTheme('dark'))}
        >
          <Moon size={16} />
        </button>
      </div>
    </div>
  )
}
