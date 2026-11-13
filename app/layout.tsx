import type { Metadata } from 'next'
import { getTheme } from '../i18n/theme'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getTranslations } from 'next-intl/server'
import './globals.css'
import './themes.css'
import { cookies } from 'next/headers'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')
  return { title: t('title'), description: t('description'), icons: { icon: "/favicon.svg", apple: "/brand/logo.png" }, openGraph: { images: ["/brand/logo.png"] } }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const theme = await getTheme()
  const colorTheme = (await cookies()).get("idearoute_color_theme")?.value === "purple" ? "purple" : "blue"
  return (
    <html lang={locale} data-theme={theme} data-color-theme={colorTheme}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
