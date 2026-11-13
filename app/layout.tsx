import { inter, onest, jetbrainsMono } from './fonts'
import type { Metadata } from 'next'
import { getColorTheme, getTheme } from '../i18n/theme'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages, getTranslations } from 'next-intl/server'
import './globals.css'
import './themes.css'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common')
  return { title: t('title'), description: t('description'), icons: { icon: "/favicon.svg", apple: "/brand/logo.png" }, openGraph: { images: ["/brand/logo.png"] } }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [locale, theme, messages, colorTheme] = await Promise.all([
    getLocale(), getTheme(), getMessages(), getColorTheme(),
  ])
  const { common, ui, requestsMvp, chat, telegram, command, dashboardShell } = messages
  const clientMessages = { common, ui, requestsMvp, chat, telegram, command, dashboardShell }
  return (
    <html className={`${inter.variable} ${onest.variable} ${jetbrainsMono.variable}`} lang={locale} data-theme={theme} data-color-theme={colorTheme}>
      <body>
        <NextIntlClientProvider messages={clientMessages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}
