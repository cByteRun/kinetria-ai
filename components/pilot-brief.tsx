'use client'

import { useTranslations } from 'next-intl'
import { useState, type FormEvent } from 'react'
import { ArrowRight, Download, Mail } from 'lucide-react'

const scopes = ['one', 'two', 'three', 'undecided'] as const

export function PilotBrief({ contactEmail }: { contactEmail?: string }) {
  const t = useTranslations('pilot')
  const [request, setRequest] = useState<{
    company: string
    scope: (typeof scopes)[number]
    details: string
  } | null>(null)
  const brief =
    request &&
    [
      t('briefTitle'),
      t('briefCompany', { value: request.company }),
      t('briefScope', { value: t(request.scope) }),
      request.details ? t('briefDetails', { value: request.details }) : '',
    ]
      .filter(Boolean)
      .join('\n\n')

  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const company = String(fields.get('company') ?? '').trim()
    const scope = scopes.find((option) => option === fields.get('scope'))
    if (!company || !scope) return
    const details = String(fields.get('details') ?? '').trim()
    setRequest({ company, scope, details })
  }

  return (
    <div className="estimate-panel">
      <form onSubmit={prepare} onChange={() => setRequest(null)}>
        <label>
          {t('company')}
          <input
            name="company"
            placeholder={t('companyHint')}
            maxLength={120}
            pattern=".*\S.*"
            required
          />
        </label>
        <label>
          {t('scope')}
          <select name="scope" defaultValue="" required>
            <option value="" disabled>
              {t('select')}
            </option>
            {scopes.map((scope) => (
              <option key={scope} value={scope}>
                {t(scope)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('details')} <span>{t('optional')}</span>
          <textarea
            name="details"
            rows={3}
            maxLength={600}
            placeholder={t('example')}
          />
        </label>
        <button type="submit" className="landing-button landing-button-primary">
          {t('prepare')}
          <ArrowRight size={17} />
        </button>
      </form>
      {brief && (
        <div className="estimate-result">
          <p role="status">
            {t('ready')} {contactEmail ? t('readyEmail') : t('readyDownload')}
          </p>
          <div className="landing-actions">
            <a
              className="landing-button landing-button-secondary"
              download="kinetria-pilot.txt"
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(brief)}`}
            >
              {t('download')}
              <Download size={16} />
            </a>
            {contactEmail && (
              <a
                className="landing-button landing-button-secondary"
                href={`mailto:${contactEmail}?subject=${encodeURIComponent(t('subject'))}&body=${encodeURIComponent(brief)}`}
              >
                {t('email')}
                <Mail size={16} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
