import { cookies } from 'next/headers'
import type { Theme } from './settings'

export async function getTheme(): Promise<Theme> {
  return (await cookies()).get('kinetria_theme')?.value === 'light'
    ? 'light'
    : 'dark'
}
