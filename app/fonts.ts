import localFont from 'next/font/local'

export const inter = localFont({
  src: '../public/fonts/Inter.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
})
export const onest = localFont({
  src: '../public/fonts/Onest.woff2',
  variable: '--font-onest',
  weight: '100 900',
  display: 'swap',
})
export const jetbrainsMono = localFont({
  src: '../public/fonts/JetBrainsMono.woff2',
  variable: '--font-jetbrains',
  weight: '100 800',
  display: 'swap',
  preload: false,
})
