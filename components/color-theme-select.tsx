'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

export function ColorThemeSelect() {
  const t = useTranslations('common')
  const [theme, setTheme] = useState('blue')

  useEffect(() => {
    setTheme(document.documentElement.dataset.colorTheme || 'blue')
  }, [])

  function selectTheme(value: string) {
    setTheme(value)
    document.documentElement.dataset.colorTheme = value
    document.cookie = `idearoute_color_theme=${value}; Path=/; Max-Age=31536000; SameSite=Lax`
  }

  return (
    <select
      aria-label={t('colorTheme')}
      value={theme}
      onChange={event => selectTheme(event.target.value)}
    >
      <option value="blue">Blue</option>
      <option value="purple">Purple</option>
    </select>
  )
}
