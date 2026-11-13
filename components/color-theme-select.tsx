'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import type { ColorTheme } from '../i18n/theme'

export function ColorThemeSelect({ initialTheme }: { initialTheme: ColorTheme }) {
  const t = useTranslations('common')
  const [theme, setTheme] = useState<ColorTheme>(initialTheme)

  function selectTheme(value: string) {
    if (value !== 'blue' && value !== 'purple') return
    setTheme(value)
    document.documentElement.dataset.colorTheme = value
    document.cookie = `idearoute_color_theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
  }

  const next = theme === 'blue' ? 'purple' : 'blue'
  return <button type="button" className={'color-theme-swatch swatch-' + theme}
    aria-label={t('colorTheme') + ': ' + t(theme) + ' → ' + t(next)}
    title={t('colorTheme') + ': ' + t(theme)} onClick={() => selectTheme(next)} />
}
