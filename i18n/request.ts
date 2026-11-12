import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { isLocale } from './settings'

export default getRequestConfig(async () => {
  const stored = (await cookies()).get('kinetria_locale')?.value
  const locale = isLocale(stored) ? stored : 'ru'
  return {
    locale,
    timeZone: 'Asia/Qyzylorda',
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
