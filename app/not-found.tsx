import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export default async function NotFound() {
  const t = await getTranslations('common')
  return (
    <main className="container workspace-body">
      <h1>{t('notFound')}</h1>
      <Link href="/">{t('home')}</Link>
    </main>
  )
}
