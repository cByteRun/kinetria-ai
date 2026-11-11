export const locales = ['ru', 'en', 'kk'] as const
export type Locale = (typeof locales)[number]
export type Theme = 'light' | 'dark'

export function isLocale(value: unknown): value is Locale {
  return locales.some((locale) => locale === value)
}
