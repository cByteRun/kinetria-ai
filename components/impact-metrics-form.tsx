'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ImpactMetrics } from '../lib/impact-metrics'
import { saveImpactMetrics } from '../app/workspace/product-actions'

export function ImpactMetricsForm({ id, metrics, unavailable = false }: { id: string; metrics: ImpactMetrics | null; unavailable?: boolean }) {
  const t = useTranslations('productExpansion')
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState('')
  return <form ref={formRef} className="impact-metrics-form" aria-busy={pending} onSubmit={event => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const number = (key: string) => String(form.get(key) ?? '').trim() === '' ? null : Number(form.get(key))
    setMessage('')
    start(async () => {
      try {
        const result = await saveImpactMetrics(id, { hours_per_month: number('hours'), monthly_value: number('value'), currency: String(form.get('currency') || '').trim().toUpperCase() || null, basis: String(form.get('basis') || '') })
        setMessage(result.error || 'metricsSaved')
        if (!result.error) router.refresh()
      } catch { setMessage('saveError') }
    })
  }}>
    <h3>{t('metricsTitle')}</h3><p>{t('metricsHelp')}</p>
    <div className="impact-example"><button className="btn sm" type="button" disabled={pending} onClick={() => {
      const values = { hours: '10', value: '50000', currency: 'KZT', basis: t('metricsExampleBasis') }
      for (const [name, value] of Object.entries(values)) {
        const field = formRef.current?.elements.namedItem(name)
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) field.value = value
      }
      setMessage('')
    }}>{t('fillMetricsExample')}</button><small>{t('metricsExampleHelp')}</small></div>
    <fieldset disabled={pending || unavailable}>
      <label>{t('hoursMetric')}<input name="hours" placeholder="10" type="number" min="0" max="100000" step="any" defaultValue={metrics?.hours_per_month ?? ''} /></label>
      <label>{t('valueMetric')}<input name="value" placeholder="50000" type="number" min="0" max="1000000000000" step="any" defaultValue={metrics?.monthly_value ?? ''} /></label>
      <label>{t('currencyMetric')}<input name="currency" placeholder="KZT" maxLength={3} pattern="[A-Za-z]{3}" defaultValue={metrics?.currency ?? ''} /></label>
      <label>{t('basisMetric')}<textarea name="basis" placeholder={t('metricsExampleBasis')} rows={4} maxLength={4000} defaultValue={metrics?.basis ?? ''} /></label>
      <button className="btn primary" type="submit">{pending ? t('working') : t('saveMetrics')}</button>
    </fieldset>
    {unavailable && <p role="status">{t('metricsUnavailable')}</p>}
    {message && <p role="status">{t(message)}</p>}
  </form>
}
