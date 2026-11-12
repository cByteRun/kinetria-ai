'use client'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Send } from 'lucide-react'
import { createTelegramLink } from '../app/workspace/telegram-actions'
export function TelegramLink() {
  const t = useTranslations('telegram')
  const [url, setUrl] = useState(''), [error, setError] = useState<'session' | 'configuration' | 'database'>()
  const [pending, start] = useTransition()
  return <section className="card detail-block ir-section-gap">
    <h2><Send size={18} /> Telegram</h2><p className="form-hint">{t('description')}</p>
    <button className="btn" disabled={pending} onClick={() => start(async () => {
      const result = await createTelegramLink(); setError(result.error); setUrl(result.url || '')
    })}>{pending ? t('pending') : t('connect')}</button>
    {url && <p><a href={url} target="_blank" rel="noreferrer">{t('open')}</a></p>}
    {error && <p role="alert">{t(error + 'Error')}</p>}
  </section>
}
