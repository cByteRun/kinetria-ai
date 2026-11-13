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

  return (
    <select
      className="color-theme-select"
      aria-label={t('colorTheme')}
      value={theme}
      onChange={event => selectTheme(event.target.value)}
    >
      <option value="blue">Blue</option>
      <option value="purple">Purple</option>
    </select>
  )
}
