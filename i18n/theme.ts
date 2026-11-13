import { cookies } from 'next/headers'
import type { Theme } from './settings'

export async function getTheme(): Promise<Theme> {
  return (await cookies()).get('kinetria_theme')?.value === 'light'
    ? 'light'
    : 'dark'
}

export type ColorTheme = 'blue' | 'purple'

export async function getColorTheme(): Promise<ColorTheme> {
  return (await cookies()).get('idearoute_color_theme')?.value === 'purple'
    ? 'purple'
    : 'blue'
}
