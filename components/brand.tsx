import { LogoMark } from './logo-mark'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export function Brand() {
  const t = useTranslations('common')
  return (
    <Link className="brand" href="/" aria-label={t('brand')}>
      <span className="route-brand-icon" aria-hidden="true"><LogoMark size={28} /></span>
      <span>
        IdeaRoute
      </span>
    </Link>
  )
}
