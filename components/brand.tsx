import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { Route } from 'lucide-react'

export function Brand() {
  const t = useTranslations('common')
  return (
    <Link className="brand" href="/" aria-label={t('brand')}>
      <span className="route-brand-icon" aria-hidden="true"><Route size={21} /></span>
      <span>
        Idea<span className="route-brand-word">Route</span>
      </span>
    </Link>
  )
}
