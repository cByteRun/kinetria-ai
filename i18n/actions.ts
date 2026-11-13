'use server'

import { cookies } from 'next/headers'
import { isLocale } from './settings'

const options = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 365 * 24 * 60 * 60,
}

export async function setLocale(locale: string) {
  if (isLocale(locale))
    (await cookies()).set('kinetria_locale', locale, options)
}
