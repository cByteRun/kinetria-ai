import { useTranslations } from 'next-intl'
import Link from 'next/link'

export function Brand() {
  const t = useTranslations('common')
  return (
    <Link className="brand" href="/" aria-label={t('brand')}>
      <span className="brand-icon" aria-hidden="true" />
      <span>
        KINETRIA<span className="brand-ai">AI</span>
      </span>
    </Link>
  )
}
