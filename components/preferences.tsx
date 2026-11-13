'use client'

import { ColorThemeSelect } from './color-theme-select'
import { Moon, Sun } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState, useTransition } from 'react'
import { setLocale, setTheme } from '../i18n/actions'
import { locales, type Theme } from '../i18n/settings'

export function Preferences({
  theme,
  compact = false,
}: {
  theme: Theme
  compact?: boolean
}) {
  const t = useTranslations('common')
  const ui = useTranslations('ui')
  const locale = useLocale()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState(false)
  function save(action: () => Promise<void>) {
    setError(false)
    startTransition(async () => {
      try {
        await action()
      } catch {
        setError(true)
      }
    })
  }
  return (
    <div
      className={'preferences' + (compact ? ' preferences-compact' : '')}
      aria-busy={pending}
    >
      {compact ? (
        <select
          aria-label={t('language')}
          value={locale}
          disabled={pending}
          onChange={(event) => save(() => setLocale(event.target.value))}
        >
          {locales.map((language) => (
            <option key={language} value={language} lang={language}>
              {language.toUpperCase()}
            </option>
          ))}
        </select>
      ) : (
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
              onClick={() => save(() => setLocale(language))}
            >
              {language.toUpperCase()}
            </button>
          ))}
        </div>
      )}
      {compact ? (
        <button
          type="button"
          className="icon-button theme-toggle"
          disabled={pending}
          aria-label={ui(
            theme === 'light' ? 'switchToDarkTheme' : 'switchToLightTheme',
          )}
          onClick={() =>
            save(() => setTheme(theme === 'light' ? 'dark' : 'light'))
          }
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      ) : (
        <div role="group" aria-label={t('theme')} className="preferences-group">
          {(['light', 'dark'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-label={t(value)}
              aria-pressed={theme === value}
              disabled={pending}
              onClick={() => save(() => setTheme(value))}
            >
              {value === 'light' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          ))}
        </div>
      )}
      <ColorThemeSelect />
      {error && (
        <span className="preferences-error" role="alert">
          {ui('preferenceError')}
        </span>
      )}
    </div>
  )
}
