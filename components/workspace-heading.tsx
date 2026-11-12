import { useTranslations } from 'next-intl'
export function Heading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  const ui = useTranslations('ui')

  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{ui('workspace')}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}
